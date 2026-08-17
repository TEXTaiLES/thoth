#include "geodesic.h"

#include <algorithm>
#include <cfloat>
#include <cmath>
#include <cstring>
#include <exception>
#include <iterator>
#include <memory>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include "geodesic_algorithm_exact.h"

namespace
{
struct MeshData
{
    std::unique_ptr<geodesic::Mesh> mesh;
};

std::unordered_map<std::string, MeshData> meshDatabase;

struct Vec3
{
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;

    Vec3() = default;
    Vec3(double xValue, double yValue, double zValue) : x(xValue), y(yValue), z(zValue) {}

    Vec3 operator+(const Vec3& other) const { return { x + other.x, y + other.y, z + other.z }; }
    Vec3 operator-(const Vec3& other) const { return { x - other.x, y - other.y, z - other.z }; }
    Vec3 operator*(double scalar) const { return { x * scalar, y * scalar, z * scalar }; }
};

double dot(const Vec3& first, const Vec3& second)
{
    return first.x * second.x + first.y * second.y + first.z * second.z;
}

double lengthSquared(const Vec3& value)
{
    return dot(value, value);
}

Vec3 closestPointOnTriangle(
    const Vec3& point,
    const Vec3& first,
    const Vec3& second,
    const Vec3& third
)
{
    const Vec3 firstSecond = second - first;
    const Vec3 firstThird = third - first;
    const Vec3 firstPoint = point - first;
    const double d1 = dot(firstSecond, firstPoint);
    const double d2 = dot(firstThird, firstPoint);

    if (d1 <= 0.0 && d2 <= 0.0) return first;

    const Vec3 secondPoint = point - second;
    const double d3 = dot(firstSecond, secondPoint);
    const double d4 = dot(firstThird, secondPoint);
    if (d3 >= 0.0 && d4 <= d3) return second;

    const double vc = d1 * d4 - d3 * d2;
    if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0)
    {
        const double ratio = d1 / (d1 - d3);
        return first + firstSecond * ratio;
    }

    const Vec3 thirdPoint = point - third;
    const double d5 = dot(firstSecond, thirdPoint);
    const double d6 = dot(firstThird, thirdPoint);
    if (d6 >= 0.0 && d5 <= d6) return third;

    const double vb = d5 * d2 - d1 * d6;
    if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0)
    {
        const double ratio = d2 / (d2 - d6);
        return first + firstThird * ratio;
    }

    const double va = d3 * d6 - d5 * d4;
    if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0)
    {
        const double ratio = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return second + (third - second) * ratio;
    }

    const double denominator = 1.0 / (va + vb + vc);
    const double secondWeight = vb * denominator;
    const double thirdWeight = vc * denominator;
    const double firstWeight = 1.0 - secondWeight - thirdWeight;
    return first * firstWeight + second * secondWeight + third * thirdWeight;
}

geodesic::SurfacePoint findNearestSurfacePoint(
    geodesic::Mesh& mesh,
    double x,
    double y,
    double z
)
{
    const Vec3 queryPoint(x, y, z);
    double bestDistanceSquared = DBL_MAX;
    geodesic::face_pointer bestFace = nullptr;
    Vec3 bestPoint;

    for (unsigned index = 0; index < mesh.faces().size(); ++index)
    {
        auto* face = &mesh.faces()[index];
        auto& vertices = face->adjacent_vertices();
        const Vec3 first(vertices[0]->x(), vertices[0]->y(), vertices[0]->z());
        const Vec3 second(vertices[1]->x(), vertices[1]->y(), vertices[1]->z());
        const Vec3 third(vertices[2]->x(), vertices[2]->y(), vertices[2]->z());
        const Vec3 surfacePoint = closestPointOnTriangle(queryPoint, first, second, third);
        const double distanceSquared = lengthSquared(surfacePoint - queryPoint);

        if (distanceSquared < bestDistanceSquared)
        {
            bestDistanceSquared = distanceSquared;
            bestFace = face;
            bestPoint = surfacePoint;
        }
    }

    if (!bestFace) return geodesic::SurfacePoint();
    return geodesic::SurfacePoint(bestFace, bestPoint.x, bestPoint.y, bestPoint.z);
}

bool isFiniteVector(const std::vector<double>& values)
{
    return std::all_of(values.begin(), values.end(), [](double value) {
        return std::isfinite(value);
    });
}
}

bool loadMesh(
    const std::string& mesh_id,
    const std::vector<double>& vertices,
    const std::vector<unsigned>& faces
)
{
    if (
        mesh_id.empty() ||
        vertices.size() < 9 ||
        vertices.size() % 3 != 0 ||
        faces.size() < 3 ||
        faces.size() % 3 != 0 ||
        !isFiniteVector(vertices)
    ) return false;

    const unsigned vertexCount = static_cast<unsigned>(vertices.size() / 3);
    if (std::any_of(faces.begin(), faces.end(), [vertexCount](unsigned index) {
        return index >= vertexCount;
    })) return false;

    try
    {
        std::vector<double> meshVertices(vertices);
        std::vector<unsigned> meshFaces(faces);
        MeshData data;
        data.mesh = std::make_unique<geodesic::Mesh>();
        data.mesh->initialize_mesh_data(meshVertices, meshFaces);
        meshDatabase.insert_or_assign(mesh_id, std::move(data));
        return true;
    }
    catch (const std::exception&)
    {
        return false;
    }
}

QueryResult query(
    const std::string& mesh_id,
    double x1,
    double y1,
    double z1,
    double x2,
    double y2,
    double z2
)
{
    QueryResult result;
    const auto meshEntry = meshDatabase.find(mesh_id);
    if (meshEntry == meshDatabase.end())
    {
        result.error = "mesh not found";
        return result;
    }

    if (!meshEntry->second.mesh)
    {
        result.error = "invalid mesh";
        return result;
    }

    const double coordinates[] = { x1, y1, z1, x2, y2, z2 };
    if (!std::all_of(std::begin(coordinates), std::end(coordinates), [](double value) {
        return std::isfinite(value);
    }))
    {
        result.error = "invalid coordinates";
        return result;
    }

    try
    {
        geodesic::Mesh& mesh = *meshEntry->second.mesh;
        geodesic::GeodesicAlgorithmExact algorithm(&mesh);
        geodesic::SurfacePoint source = findNearestSurfacePoint(mesh, x1, y1, z1);
        geodesic::SurfacePoint target = findNearestSurfacePoint(mesh, x2, y2, z2);
        std::vector<geodesic::SurfacePoint> sources { source };
        std::vector<geodesic::SurfacePoint> targets { target };
        algorithm.propagate(sources, geodesic::GEODESIC_INF, &targets);

        std::vector<geodesic::SurfacePoint> path;
        algorithm.trace_back(target, path);
        if (path.empty())
        {
            result.error = "path not found";
            return result;
        }

        result.status = true;
        result.distance = geodesic::length(path);
        result.path.reserve(path.size());
        for (auto& point : path)
        {
            result.path.push_back({ point.x(), point.y(), point.z() });
        }
    }
    catch (const std::exception& error)
    {
        result.error = error.what();
    }

    return result;
}
