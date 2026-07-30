
#include <iostream>
#include <sstream>
#include <vector>
#include <string>
#include <memory>
#include <limits>
#include <cmath>
#include <cfloat>
#include <algorithm>
#include <iomanip>
#include <unordered_map>
#include "geodesic.h"
#include "geodesic_algorithm_exact.h"

using namespace std;

struct MeshData
{
	std::unique_ptr<geodesic::Mesh> mesh;
	std::unique_ptr<geodesic::GeodesicAlgorithmExact> algorithm;
	std::vector<double> points;
	std::vector<unsigned> faces;
};

//global registry of meshes
std::unordered_map<std::string, MeshData> meshDB;

// ---------------------------------------------------------
// Basic vector
// ---------------------------------------------------------
struct Vec3
{
	double x, y, z;

	Vec3() : x(0), y(0), z(0) {}
	Vec3(double X, double Y, double Z) : x(X), y(Y), z(Z) {}

	Vec3 operator+(const Vec3& b) const
	{
		return Vec3(x + b.x, y + b.y, z + b.z);
	}

	Vec3 operator-(const Vec3& b) const
	{
		return Vec3(x - b.x, y - b.y, z - b.z);
	}

	Vec3 operator*(double s) const
	{
		return Vec3(x * s, y * s, z * s);
	}
};

static inline double dot(const Vec3& a, const Vec3& b)
{
	return a.x*b.x + a.y*b.y + a.z*b.z;
}

static inline double length2(const Vec3& v)
{
	return dot(v, v);
}

// Closest point on triangle
// Returns:
//  - closest point
//  - barycentric coordinates u,v,w
static Vec3 closestPointTriangle(const Vec3& p,const Vec3& a,const Vec3& b,const Vec3& c,double& u,double& v,double& w)
{
	Vec3 ab = b - a;
	Vec3 ac = c - a;
	Vec3 ap = p - a;

	double d1 = dot(ab, ap);
	double d2 = dot(ac, ap);

	if (d1 <= 0.0 && d2 <= 0.0)
	{
		u = 1.0;
		v = 0.0;
		w = 0.0;
		return a;
	}

	Vec3 bp = p - b;
	double d3 = dot(ab, bp);
	double d4 = dot(ac, bp);

	if (d3 >= 0.0 && d4 <= d3)
	{
		u = 0.0;
		v = 1.0;
		w = 0.0;
		return b;
	}

	double vc = d1 * d4 - d3 * d2;
	if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0)
	{
		double t = d1 / (d1 - d3);

		u = 1.0 - t;
		v = t;
		w = 0.0;

		return a + ab * t;
	}

	Vec3 cp = p - c;
	double d5 = dot(ab, cp);
	double d6 = dot(ac, cp);

	if (d6 >= 0.0 && d5 <= d6)
	{
		u = 0.0;
		v = 0.0;
		w = 1.0;
		return c;
	}

	double vb = d5 * d2 - d1 * d6;
	if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0)
	{
		double t = d2 / (d2 - d6);

		u = 1.0 - t;
		v = 0.0;
		w = t;

		return a + ac * t;
	}

	double va = d3 * d6 - d5 * d4;
	if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0)
	{
		double t = (d4 - d3) / ((d4 - d3) + (d5 - d6));

		u = 0.0;
		v = 1.0 - t;
		w = t;

		return b + (c - b)*t;
	}

	double denom = 1.0 / (va + vb + vc);

	v = vb * denom;
	w = vc * denom;
	u = 1.0 - v - w;

	return a * u + b * v + c * w;
}
// Find nearest surface point

static geodesic::SurfacePoint findNearestSurfacePoint(geodesic::Mesh& mesh, double x, double y, double z)
{
	Vec3 query(x, y, z);

	double bestDist2 = DBL_MAX;

	geodesic::face_pointer bestFace = nullptr;
	Vec3 bestPoint;

	for (unsigned i = 0; i < mesh.faces().size(); ++i)
	{
		auto f = &mesh.faces()[i];

		Vec3 a(
			f->adjacent_vertices()[0]->x(),
			f->adjacent_vertices()[0]->y(),
			f->adjacent_vertices()[0]->z());

		Vec3 b(
			f->adjacent_vertices()[1]->x(),
			f->adjacent_vertices()[1]->y(),
			f->adjacent_vertices()[1]->z());

		Vec3 c(
			f->adjacent_vertices()[2]->x(),
			f->adjacent_vertices()[2]->y(),
			f->adjacent_vertices()[2]->z());

		double u, v, w;

		Vec3 p = closestPointTriangle(query, a, b, c, u, v, w);

		double d2 = length2(p - query);

		if (d2 < bestDist2)
		{
			bestDist2 = d2;
			bestFace = f;
			bestPoint = p;
		}
	}

	if (!bestFace)
		return geodesic::SurfacePoint();

	return geodesic::SurfacePoint(
		bestFace,
		bestPoint.x,
		bestPoint.y,
		bestPoint.z
	);
}

/*//old
static geodesic::SurfacePoint findNearestSurfacePoint(geodesic::Mesh& mesh,double x,double y,double z)
{
	Vec3 query(x, y, z);

	double bestDist2 = DBL_MAX;

	geodesic::face_pointer bestFace = nullptr;

	double bestU = 0;
	double bestV = 0;
	double bestW = 0;
	//Vec3 p;

	for (unsigned i = 0; i < mesh.faces().size(); i++)
	{
		auto f = &mesh.faces()[i];

		Vec3 a(
			f->adjacent_vertices()[0]->x(),
			f->adjacent_vertices()[0]->y(),
			f->adjacent_vertices()[0]->z()
		);

		Vec3 b(
			f->adjacent_vertices()[1]->x(),
			f->adjacent_vertices()[1]->y(),
			f->adjacent_vertices()[1]->z()
		);

		Vec3 c(
			f->adjacent_vertices()[2]->x(),
			f->adjacent_vertices()[2]->y(),
			f->adjacent_vertices()[2]->z()
		);

		double u, v, w;

		Vec3 p = closestPointTriangle(query,a, b, c,u, v, w);

		double d2 = length2(p - query);

		if (d2 < bestDist2)
		{
			bestDist2 = d2;
			bestFace = f;
			bestU = u;
			bestV = v;
			bestW = w;
			std::cout << "Closest point p: "
				<< p.x << " "
				<< p.y << " "
				<< p.z << std::endl;
			std::cout << "Closest point best : "
				<< bestU << " "
				<< bestV << " "
				<< bestW << std::endl;
		}
	}
	if (!bestFace)
	{
		return geodesic::SurfacePoint();
	}	
	return geodesic::SurfacePoint(
		bestFace,
		bestU,
		bestV,
		bestW//,
	//	geodesic::SurfacePoint::FACE_POINT
	);
}
*/
static unsigned findNearestVertex(const std::vector<double>& points,double x,double y,double z)
{
	unsigned nearest = 0;
	double minDist = std::numeric_limits<double>::max();

	unsigned count = points.size() / 3;

	for (unsigned i = 0; i < count; i++)
	{
		double vx = points[i * 3];
		double vy = points[i * 3 + 1];
		double vz = points[i * 3 + 2];

		double dx = vx - x;
		double dy = vy - y;
		double dz = vz - z;

		double dist = dx * dx + dy * dy + dz * dz;

		if (dist < minDist)
		{
			minDist = dist;
			nearest = i;
		}
	}

	return nearest;
}

//loads the vertices and faces
bool loadMesh(std::string& model_id, std::vector<double>& vertices, std::vector<unsigned>& faces)
{
	unsigned maxIndex = 0;

	for (auto i : faces)
		if (i > maxIndex) maxIndex = i;

	if (maxIndex >= vertices.size() / 3)
	{
		std::cerr << "[CPP][LOAD] INVALID INDEX\n";
		return false;
	}

	MeshData data;
	data.points = vertices;
	data.faces = faces;
	try
	{
		data.mesh = std::make_unique<geodesic::Mesh>();
		data.mesh->initialize_mesh_data(data.points, data.faces);

		data.algorithm =std::make_unique<geodesic::GeodesicAlgorithmExact>(data.mesh.get());
	}
	catch (const std::exception& e)
	{
		std::cerr << "[CPP][LOAD] Geodesic init failed: "
			<< e.what() << std::endl;
		return false;
	}

	meshDB[model_id] = std::move(data);
	/*
	std::cout << "{\"status\":\"ok\",\"model_id\":\""
		<< model_id << "\"}\n";

	std::cout.flush();
	*/
	return true;
}

//queries
//static void handleQueryFromData(std::string& model_id,unsigned src,unsigned dst)
QueryResult query(std::string& model_id, double x1, double y1, double z1, double x2, double y2, double z2)
{
	QueryResult result;
	auto it = meshDB.find(model_id);
	if (it == meshDB.end())
	{
		result.error = "mesh not found";
		return result;
	}

	MeshData& data = it->second;

	if (!data.mesh || !data.algorithm)
	{
		result.error = "invalid mesh";
		return result;
	}
	unsigned n = data.points.size() / 3;
	//auto& mesh = *data.mesh;
	geodesic::Mesh& geoMesh = *(data.mesh);
	geodesic::GeodesicAlgorithmExact algo(&geoMesh);

	// nearest points ON THE SURFACE
	geodesic::SurfacePoint source = findNearestSurfacePoint(geoMesh, x1, y1, z1);
	geodesic::SurfacePoint target = findNearestSurfacePoint(geoMesh, x2, y2, z2);
	/*
	std::cout << "INPUT : "
		<< x1 << " "
		<< y1 << " "
		<< z1 << std::endl;

	std::cout << "SOURCE: "
		<< source.x() << " "
		<< source.y() << " "
		<< source.z() << std::endl;

	std::cout << "TARGET: "
		<< target.x() << " "
		<< target.y() << " "
		<< target.z() << std::endl;
	*/
	// propagate
	std::vector<geodesic::SurfacePoint> sources;
	sources.push_back(source);
	std::vector<geodesic::SurfacePoint> targets;
	targets.push_back(target);
	algo.propagate(sources,geodesic::GEODESIC_INF,&targets);

	//trace back
	std::vector<geodesic::SurfacePoint> path;
	algo.trace_back(target, path);

	if (path.empty())
	{
		result.error = "empty path";
		return result;
	}
	/*
	for (size_t i = 0; i < path.size(); ++i)
	{
		std::cout
			<< "PATH " << i << " "
			<< path[i].x() << " "
			<< path[i].y() << " "
			<< path[i].z() << std::endl;
	}
	*/
	result.status = true;
	result.distance = geodesic::length(path);

	for (auto& p : path)
	{
		result.path.push_back({p.x(),p.y(),p.z()});
	}
	return result;
}