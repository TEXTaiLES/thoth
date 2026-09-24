#include "geodesic_heat.h"
#include <algorithm>
#include <cmath>
#include <cfloat>
#include <iostream>
#include <limits>
#include <string>
#include <unordered_map>
#include <vector>

namespace
{

	// ============================================================
	// Basic vector
	// ============================================================

	struct Vec3
	{
		double x = 0.0;
		double y = 0.0;
		double z = 0.0;

		Vec3() = default;

		Vec3(double X, double Y, double Z)
			: x(X), y(Y), z(Z)
		{
		}

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

		Vec3 operator/(double s) const
		{
			return Vec3(x / s, y / s, z / s);
		}

		Vec3& operator+=(const Vec3& b)
		{
			x += b.x;
			y += b.y;
			z += b.z;
			return *this;
		}
	};

	static double dot(const Vec3& a, const Vec3& b)
	{
		return
			a.x * b.x +
			a.y * b.y +
			a.z * b.z;
	}

	static Vec3 cross(const Vec3& a, const Vec3& b)
	{
		return Vec3(
			a.y * b.z - a.z * b.y,
			a.z * b.x - a.x * b.z,
			a.x * b.y - a.y * b.x
		);
	}

	static double length(const Vec3& a)
	{
		return std::sqrt(dot(a, a));
	}

	static Vec3 normalize(const Vec3& a)
	{
		double l = length(a);

		if (l < 1e-14)
			return Vec3();

		return a / l;
	}

	static double cotangent(const Vec3& a,const Vec3& b)
	{
		Vec3 c = cross(a, b);
		double denominator = length(c);
		if (denominator < 1e-14)
			return 0.0;

		return dot(a, b) / denominator;
	}


	// ============================================================
	// Sparse matrix
	// ============================================================

	struct SparseMatrix
	{
		unsigned n = 0;

		std::vector<std::unordered_map<unsigned, double>> rows;

		SparseMatrix() = default;

		explicit SparseMatrix(unsigned size)
			: n(size),
			rows(size)
		{
		}

		void add(unsigned row,unsigned col,double value)
		{
			if (std::abs(value) < 1e-20)
				return;

			rows[row][col] += value;
		}

		void set(unsigned row,unsigned col,double value)
		{
			rows[row][col] = value;
		}

		double get(unsigned row,unsigned col) const
		{
			auto it = rows[row].find(col);

			if (it == rows[row].end())
				return 0.0;

			return it->second;
		}

		std::vector<double> multiply(const std::vector<double>& x) const
		{
			std::vector<double> result(n, 0.0);

			for (unsigned i = 0; i < n; ++i)
			{
				for (const auto& entry : rows[i])
				{
					result[i] +=entry.second *x[entry.first];
				}
			}

			return result;
		}
	};


	// ============================================================
	// Sparse conjugate gradient solver
	// ============================================================
	static bool conjugateGradient(const SparseMatrix& A,const std::vector<double>& b,std::vector<double>& x,unsigned maxIterations = 20000,double tolerance = 1e-8)
	{
		const unsigned n = A.n;
		x.assign(n, 0.0);
		std::vector<double> r(n, 0.0);
		std::vector<double> z(n, 0.0);
		std::vector<double> p(n, 0.0);
		std::vector<double> Ap(n, 0.0);
		/*
			Initial residual:

				r = b - A*x
			x starts at zero, therefore:
				r = b
		*/
		r = b;
		/*
			Jacobi preconditioner:

				z = M^-1 r

			where M is the diagonal of A.
		*/

		for (unsigned i = 0; i < n; ++i)
		{
			double diagonal = A.get(i, i);

			if (!std::isfinite(diagonal) ||
				std::abs(diagonal) < 1e-20)
			{
				//A zero diagonal means the system is singular or invalid.				
				std::cerr
					<< "[HEAT][CG] invalid diagonal at "
					<< i
					<< " value="
					<< diagonal
					<< std::endl;

				return false;
			}

			z[i] =r[i] / diagonal;
		}

		p = z;
		double rzOld = 0.0;

		for (unsigned i = 0; i < n; ++i)
			rzOld += r[i] * z[i];

		if (!std::isfinite(rzOld))
		{
			std::cerr
				<< "[HEAT][CG] invalid initial residual"
				<< std::endl;

			return false;
		}

		double initialResidual = 0.0;

		for (double value : r)
			initialResidual += value * value;

		initialResidual = std::sqrt(initialResidual);

		if (initialResidual < tolerance)
			return true;

		/*
			Relative tolerance.

			This is much more appropriate for the
			differently-scaled matrices produced by
			triangle meshes.
		*/

		const double targetResidual =std::max(tolerance * initialResidual,1e-12);

		for (unsigned iteration = 0;iteration < maxIterations;++iteration)
		{
			Ap = A.multiply(p);
			double denominator = 0.0;

			for (unsigned i = 0; i < n; ++i)
				denominator += p[i] * Ap[i];
			
				//For a positive definite system: p^T A p > 0

			if (!std::isfinite(denominator) || denominator <= 1e-30)
			{
				std::cerr
					<< "[HEAT][CG] invalid denominator"
					<< " iteration="
					<< iteration
					<< " denominator="
					<< denominator
					<< std::endl;

				return false;
			}

			double alpha =rzOld / denominator;

			if (!std::isfinite(alpha))
			{
				std::cerr
					<< "[HEAT][CG] invalid alpha"
					<< " iteration="
					<< iteration
					<< std::endl;

				return false;
			}

			for (unsigned i = 0; i < n; ++i)
			{
				x[i] += alpha * p[i];
				r[i] -= alpha * Ap[i];
			}

			double residual = 0.0;

			for (double value : r)
				residual += value * value;

			residual = std::sqrt(residual);

			if (!std::isfinite(residual))
			{
				std::cerr
					<< "[HEAT][CG] invalid residual"
					<< " iteration="
					<< iteration
					<< std::endl;

				return false;
			}

			if (residual < targetResidual)
			{
				std::cerr
					<< "[HEAT][CG] converged"
					<< " iteration="
					<< iteration
					<< " residual="
					<< residual
					<< std::endl;

				return true;
			}
			//Apply Jacobi preconditioner again.
			for (unsigned i = 0; i < n; ++i)
			{
				double diagonal = A.get(i, i);
				z[i] = r[i] / diagonal;
			}

			double rzNew = 0.0;

			for (unsigned i = 0; i < n; ++i)
				rzNew += r[i] * z[i];

			if (!std::isfinite(rzNew))
			{
				std::cerr
					<< "[HEAT][CG] invalid rz"
					<< " iteration="
					<< iteration
					<< std::endl;

				return false;
			}

			double beta = rzNew / rzOld;

			if (!std::isfinite(beta))
			{
				std::cerr
					<< "[HEAT][CG] invalid beta"
					<< " iteration="
					<< iteration
					<< std::endl;

				return false;
			}

			for (unsigned i = 0; i < n; ++i)
			{
				p[i] = z[i] +beta * p[i];
			}

			rzOld = rzNew;

			/*
				Occasional progress logging.
			*/

			if (iteration == 0 ||iteration % 500 == 0)
			{
				std::cerr
					<< "[HEAT][CG]"
					<< " iteration="
					<< iteration
					<< " residual="
					<< residual
					<< std::endl;
			}
		}

		std::cerr
			<< "[HEAT][CG] did not converge"
			<< " maxIterations="
			<< maxIterations
			<< std::endl;
		return false;
	}

	// ============================================================
	// Heat mesh

	struct HeatMesh
	{
		std::vector<Vec3> vertices;
		std::vector<unsigned> faces;
		unsigned vertexCount = 0;
		unsigned faceCount = 0;
		std::vector<std::vector<unsigned>> adjacency;
		SparseMatrix laplacian;
		std::vector<double> mass;
		double meanEdgeLength = 0.0;
		double timeStep = 0.0;
	};


	// ============================================================
	// Mesh registry

	std::unordered_map<std::string, HeatMesh> heatDB;

	// ============================================================
	// Build Laplacian + mass matrix

	static bool buildHeatMesh(HeatMesh& mesh)
	{
		mesh.vertexCount =static_cast<unsigned>(mesh.vertices.size());
		mesh.faceCount =static_cast<unsigned>(mesh.faces.size() / 3);

		if (mesh.vertexCount == 0)
			return false;

		if (mesh.faceCount == 0)
			return false;

		mesh.adjacency.clear();
		mesh.adjacency.resize(mesh.vertexCount);

		mesh.laplacian =SparseMatrix(mesh.vertexCount);
		mesh.mass.assign(mesh.vertexCount,0.0);

		double totalEdgeLength = 0.0;

		unsigned edgeCount = 0;

		for (unsigned f = 0;f < mesh.faceCount;++f)
		{
			unsigned i0 =mesh.faces[f * 3 + 0];
			unsigned i1 =mesh.faces[f * 3 + 1];
			unsigned i2 =mesh.faces[f * 3 + 2];

			if (i0 >= mesh.vertexCount || i1 >= mesh.vertexCount || i2 >= mesh.vertexCount)
			{
				return false;
			}

			const Vec3& p0 =mesh.vertices[i0];
			const Vec3& p1 =mesh.vertices[i1];
			const Vec3& p2 =mesh.vertices[i2];
			Vec3 e01 = p1 - p0;
			Vec3 e02 = p2 - p0;
			Vec3 e12 = p2 - p1;
			double area2 = length(cross(e01, e02));

			if (area2 < 1e-14)
				continue;

			double area =0.5 * area2;

			// ----------------------------------------------------
			// Lumped mass matrix
			mesh.mass[i0] += area / 3.0;
			mesh.mass[i1] += area / 3.0;
			mesh.mass[i2] += area / 3.0;

			// ----------------------------------------------------
			// Triangle cotangents
			Vec3 v0 = p1 - p0;
			Vec3 v1 = p2 - p0;
			Vec3 v2 = p0 - p1;
			Vec3 v3 = p2 - p1;
			Vec3 v4 = p0 - p2;
			Vec3 v5 = p1 - p2;

			double cot0 =cotangent(v0, v1);
			double cot1 =cotangent(v2, v3);
			double cot2 =cotangent(v4, v5);

			// ----------------------------------------------------
			// Cotangent Laplacian
			// L_ij = -1/2 cot(theta)
			// L_ii = -sum(off-diagonal)

			double w01 = 0.5 * cot2;
			double w12 = 0.5 * cot0;
			double w20 = 0.5 * cot1;

			mesh.laplacian.add(i0, i1, -w01);
			mesh.laplacian.add(i1, i0, -w01);
			mesh.laplacian.add(i1, i2, -w12);
			mesh.laplacian.add(i2, i1, -w12);
			mesh.laplacian.add(i2, i0, -w20);
			mesh.laplacian.add(i0, i2, -w20);
			mesh.laplacian.add(i0, i0, w01 + w20);
			mesh.laplacian.add(i1, i1, w01 + w12);
			mesh.laplacian.add(i2, i2, w12 + w20);

			// Edge statistics
			totalEdgeLength += length(e01);
			totalEdgeLength += length(e12);
			totalEdgeLength += length(e02);
			edgeCount += 3;
		}

		if (edgeCount == 0)
			return false;

		mesh.meanEdgeLength = totalEdgeLength /static_cast<double>(edgeCount);

		for (unsigned f = 0;f < mesh.faceCount;++f)
		{
			unsigned i0 =mesh.faces[f * 3 + 0];
			unsigned i1 =mesh.faces[f * 3 + 1];
			unsigned i2 =mesh.faces[f * 3 + 2];

			mesh.adjacency[i0].push_back(i1);
			mesh.adjacency[i0].push_back(i2);

			mesh.adjacency[i1].push_back(i0);
			mesh.adjacency[i1].push_back(i2);

			mesh.adjacency[i2].push_back(i0);
			mesh.adjacency[i2].push_back(i1);
		}
		//we dont want duplicate neighbors so we erase them
		for (auto& neighbors : mesh.adjacency)
		{
			std::sort(neighbors.begin(),neighbors.end());
			neighbors.erase(std::unique(neighbors.begin(),neighbors.end()),neighbors.end());
		}

	  //Standard Heat Method time scale:t ≈ meanEdgeLength² -This is a good starting value for arbitrary triangle meshes.

		mesh.timeStep =mesh.meanEdgeLength * mesh.meanEdgeLength * 0.25;//added 0.25 to be configurable

		if (mesh.timeStep < 1e-14)
			mesh.timeStep = 1e-4;

		return true;
	}

	// ============================================================
	// Nearest vertex
	// ============================================================
	/*
	static unsigned findNearestVertex(const HeatMesh& mesh,double x,double y,double z)
	{
		Vec3 query(x, y, z);
		unsigned nearest = 0;
		double best =std::numeric_limits<double>::max();

		for (unsigned i = 0;i < mesh.vertexCount;++i)
		{
			Vec3 d =mesh.vertices[i] -query;
			double dist2 =dot(d, d);
			if (dist2 < best)
			{
				best = dist2;
				nearest = i;
			}
		}

		return nearest;
	}
	*/
	// ============================================================
// Closest point on mesh surface
// ============================================================
	//still brute force
	struct SurfacePoint
	{
		unsigned face = 0;

		unsigned i0 = 0;
		unsigned i1 = 0;
		unsigned i2 = 0;

		Vec3 point;

		double w0 = 0.0;
		double w1 = 0.0;
		double w2 = 0.0;

		double distance2 = std::numeric_limits<double>::max();
	};

	static Vec3 closestPointOnTriangle(const Vec3& p,const Vec3& a,const Vec3& b,const Vec3& c)
	{
		const Vec3 ab = b - a;
		const Vec3 ac = c - a;
		const Vec3 ap = p - a;

		const double d1 = dot(ab, ap);
		const double d2 = dot(ac, ap);

		if (d1 <= 0.0 && d2 <= 0.0)
			return a;

		const Vec3 bp = p - b;

		const double d3 = dot(ab, bp);
		const double d4 = dot(ac, bp);

		if (d3 >= 0.0 && d4 <= d3)
			return b;

		const double vc = d1 * d4 - d3 * d2;

		if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0)
		{
			const double v = d1 / (d1 - d3);
			return a + ab * v;
		}

		const Vec3 cp = p - c;

		const double d5 = dot(ab, cp);
		const double d6 = dot(ac, cp);

		if (d6 >= 0.0 && d5 <= d6)
			return c;

		const double vb = d5 * d2 - d1 * d6;

		if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0)
		{
			const double w = d2 / (d2 - d6);
			return a + ac * w;
		}

		const double va = d3 * d6 - d5 * d4;

		if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0)
		{
			const Vec3 bc = c - b;
			const double w = (d4 - d3) / ((d4 - d3) + (d5 - d6));

			return b + bc * w;
		}

		const double denominator = 1.0 / (va + vb + vc);

		const double v = vb * denominator;
		const double w = vc * denominator;

		return a + ab * v + ac * w;
	}


	static void computeBarycentric(const Vec3& p,const Vec3& a,const Vec3& b,const Vec3& c,double& w0,double& w1,double& w2)
	{
		const Vec3 v0 = b - a;
		const Vec3 v1 = c - a;
		const Vec3 v2 = p - a;

		const double d00 = dot(v0, v0);
		const double d01 = dot(v0, v1);
		const double d11 = dot(v1, v1);
		const double d20 = dot(v2, v0);
		const double d21 = dot(v2, v1);

		const double denominator = d00 * d11 - d01 * d01;

		if (std::abs(denominator) < 1e-20)
		{
			w0 = 1.0;
			w1 = 0.0;
			w2 = 0.0;
			return;
		}

		w1 = (d11 * d20 - d01 * d21) / denominator;
		w2 = (d00 * d21 - d01 * d20) / denominator;
		w0 = 1.0 - w1 - w2;

		// Protect against tiny floating-point errors.
		w0 = std::max(0.0, std::min(1.0, w0));
		w1 = std::max(0.0, std::min(1.0, w1));
		w2 = std::max(0.0, std::min(1.0, w2));

		const double sum = w0 + w1 + w2;

		if (sum > 1e-20)
		{
			w0 /= sum;
			w1 /= sum;
			w2 /= sum;
		}
	}

	static SurfacePoint findClosestSurfacePoint(const HeatMesh& mesh, double x, double y, double z)
	{
		SurfacePoint result;

		const Vec3 query(x, y, z);

		for (unsigned f = 0; f < mesh.faceCount; ++f)
		{
			const unsigned i0 = mesh.faces[f * 3 + 0];
			const unsigned i1 = mesh.faces[f * 3 + 1];
			const unsigned i2 = mesh.faces[f * 3 + 2];

			if (i0 >= mesh.vertexCount || i1 >= mesh.vertexCount || i2 >= mesh.vertexCount)
			{
				continue;
			}

			const Vec3& a = mesh.vertices[i0];
			const Vec3& b = mesh.vertices[i1];
			const Vec3& c = mesh.vertices[i2];

			const Vec3 closest = closestPointOnTriangle(query,a,b,c);

			const Vec3 delta = closest - query;
			const double dist2 = dot(delta, delta);

			if (dist2 < result.distance2)
			{
				result.face = f;

				result.i0 = i0;
				result.i1 = i1;
				result.i2 = i2;

				result.point = closest;
				result.distance2 = dist2;

				computeBarycentric(closest,a,b,c,result.w0,result.w1,result.w2);
			}
		}
		return result;
	}

	// ============================================================
	// Heat diffusion
	// (M - tL) u = M delta

	static bool solveHeat(const HeatMesh& mesh, 
		unsigned source0,
		unsigned source1,
		unsigned source2,
		double w0,
		double w1,
		double w2, 
		std::vector<double>& u)
	{
		const unsigned n =mesh.vertexCount;
		SparseMatrix A(n);
		std::vector<double> b(n, 0.0);

		for (unsigned i = 0;i < n;++i)
		{
			/*
				M - tL -->ive changed to M+tL
			*/
			for (const auto& entry :
				mesh.laplacian.rows[i])
			{
				unsigned j =entry.first;
				double value =mesh.timeStep *entry.second;
				A.add(i, j, value);
			}

			A.add(i, i, mesh.mass[i]);
		}
		double minDiagonal = std::numeric_limits<double>::max();
		double maxDiagonal = 0.0;
		for (unsigned i = 0; i < n; ++i)
		{
			double d = A.get(i, i);
			minDiagonal = std::min(minDiagonal, d);
			maxDiagonal = std::max(maxDiagonal, d);
		}

		std::cerr
			<< "[HEAT] diffusion matrix"
			<< " minDiag="
			<< minDiagonal
			<< " maxDiag="
			<< maxDiagonal
			<< std::endl;

		//M delta_source

		//b[source] = mesh.mass[source];
		// Point source represented by barycentric coordinates.
		b[source0] += w0;
		b[source1] += w1;
		b[source2] += w2;

		std::cerr
			<< "[HEAT] solving diffusion system"
			<< " n=" << n
			<< " sourceTriangle=("
			<< source0 << ","
			<< source1 << ","
			<< source2 << ")"
			<< " weights=("
			<< w0 << ","
			<< w1 << ","
			<< w2 << ")"
			<< " t="
			<< mesh.timeStep
			<< std::endl;

		return conjugateGradient(A,b,u,10000,1e-9);
	}

	// ============================================================
	// Gradient of scalar function on triangle

	static Vec3 triangleGradient(const Vec3& p0,const Vec3& p1,const Vec3& p2,double u0,double u1,double u2)
	{
		Vec3 e1 = p1 - p0;
		Vec3 e2 = p2 - p0;
		Vec3 normal = cross(e1, e2);
		double normal2 = dot(normal, normal);

		if (normal2 < 1e-20)
			return Vec3();
	
		//grad(phi) =[ (u1-u0) (n x e2) + (u2-u0) (e1 x n) ] / |n|²

		Vec3 term1 =cross(normal, e2) *(u1 - u0);
		Vec3 term2 =cross(e1, normal) *(u2 - u0);
		return (term1 + term2) /normal2;
	}

	// ============================================================
	// Divergence of normalized vector field

	static void computeDivergence(const HeatMesh& mesh, const std::vector<double>& u, std::vector<double>& divergence)
	{
		const unsigned n =mesh.vertexCount;
		divergence.assign(n,0.0);

		for (unsigned f = 0;f < mesh.faceCount;++f)
		{
			unsigned i0 = mesh.faces[f * 3 + 0];
			unsigned i1 = mesh.faces[f * 3 + 1];
			unsigned i2 = mesh.faces[f * 3 + 2];
			const Vec3& p0 = mesh.vertices[i0];
			const Vec3& p1 = mesh.vertices[i1];
			const Vec3& p2 = mesh.vertices[i2];

			Vec3 grad = triangleGradient(p0,p1,p2,u[i0],u[i1],u[i2]);

			double gradLength = length(grad);

			if (gradLength < 1e-14)
				continue;

				//X = -grad(u) / |grad(u)|

			Vec3 X =grad * (-1.0 / gradLength);
			Vec3 e0 =p2 - p1;
			Vec3 e1 =p0 - p2;
			Vec3 e2 =p1 - p0;
			Vec3 normal = normalize(cross(p1 - p0,p2 - p0));
			/*
				Rotated edge vectors.
			*/
			Vec3 nxe0 =cross(normal, e0);
			Vec3 nxe1 =cross(normal, e1);
			Vec3 nxe2 =cross(normal, e2);
			/*
				Cotangent-style divergence
				accumulation.

				Each vertex receives the
				contribution associated with
				its opposite edge.
			*/
			divergence[i0] += 0.5 * dot(X, nxe0);
			divergence[i1] += 0.5 * dot(X, nxe1);
			divergence[i2] += 0.5 * dot(X, nxe2);
		}
	}

	// ============================================================
	// Poisson solve
	// L phi = divergence
	// The Laplacian has a null space, so we pin one vertex to zero.
	static bool solvePoisson(const HeatMesh& mesh,const std::vector<double>& divergence,unsigned source,std::vector<double>& phi)
	{
		const unsigned n = mesh.vertexCount;
		SparseMatrix A(n);
		std::vector<double> b = divergence;
		
		//Pin source vertex:phi[source] = 0		
		for (unsigned i = 0;i < n;++i)
		{
			if (i == source)
				continue;

			for (const auto& entry :mesh.laplacian.rows[i])
			{
				unsigned j =entry.first;

				if (j == source)
					continue;

				A.add(i,j,entry.second);
			}
		}

		A.set(source,source,1.0);
		b[source] = 0.0;	
		//The cotangent Laplacian above ispositive semidefinite.
		return conjugateGradient(A,b,phi,20000,1e-8);
	}

	//This function simply extracts an approximate vertex path from the resulting scalar field.
	//TRYING TO FIX THE STRANGE ANGLE
	/*static bool reconstructHeatPath(const HeatMesh& mesh,const SurfacePoint& sourcePoint,const SurfacePoint& targetPoint,const std::vector<double>& phi,std::vector<PathPoint>& path)
	{
		path.clear();
		if (phi.size() != mesh.vertexCount)
			return false;
		if (sourcePoint.face >= mesh.faceCount ||targetPoint.face >= mesh.faceCount)
		{
			return false;
		}
		// ------------------------------------------------------------
		// Build face adjacency locally.
		// edge -> faces sharing that edge
		// ------------------------------------------------------------
		std::unordered_map<unsigned long long, std::vector<unsigned>> edgeFaces;
		auto edgeKey = [](unsigned a, unsigned b) -> unsigned long long
		{
			unsigned lo = std::min(a, b);
			unsigned hi = std::max(a, b);

			return	(static_cast<unsigned long long>(lo) << 32) |static_cast<unsigned long long>(hi);
		};
		for (unsigned f = 0; f < mesh.faceCount; ++f)
		{
			unsigned i0 = mesh.faces[f * 3 + 0];
			unsigned i1 = mesh.faces[f * 3 + 1];
			unsigned i2 = mesh.faces[f * 3 + 2];

			edgeFaces[edgeKey(i0, i1)].push_back(f);
			edgeFaces[edgeKey(i1, i2)].push_back(f);
			edgeFaces[edgeKey(i2, i0)].push_back(f);
		}
		// ------------------------------------------------------------
		// Find the face on the other side of an edge.
		// ------------------------------------------------------------
		auto findNeighborFace =[&](unsigned face, unsigned a, unsigned b) -> unsigned
		{
			auto it = edgeFaces.find(edgeKey(a, b));

			if (it == edgeFaces.end())
				return std::numeric_limits<unsigned>::max();

			for (unsigned candidate : it->second)
			{
				if (candidate != face)
					return candidate;
			}
			return std::numeric_limits<unsigned>::max();
		};
		// ------------------------------------------------------------
		// Barycentric coordinates.
		// ------------------------------------------------------------
		auto barycentric =[](const Vec3& p,const Vec3& p0,const Vec3& p1,const Vec3& p2,double& w0,double& w1,double& w2) -> bool
		{
			Vec3 v0 = p1 - p0;
			Vec3 v1 = p2 - p0;
			Vec3 v2 = p - p0;

			double d00 = dot(v0, v0);
			double d01 = dot(v0, v1);
			double d11 = dot(v1, v1);
			double d20 = dot(v2, v0);
			double d21 = dot(v2, v1);
			double denom = d00 * d11 - d01 * d01;
			if (std::abs(denom) < 1e-20)
				return false;

			w1 = (d11 * d20 - d01 * d21) / denom;
			w2 = (d00 * d21 - d01 * d20) / denom;
			w0 = 1.0 - w1 - w2;
			return true;
		};
		// ------------------------------------------------------------
		// Trace from target toward source through triangle interiors.
		// ------------------------------------------------------------
		Vec3 currentPoint = targetPoint.point;
		unsigned currentFace = targetPoint.face;
		std::vector<PathPoint> reversePath;
		reversePath.push_back({currentPoint.x,currentPoint.y,currentPoint.z});
		std::vector<bool> visitedFaces(mesh.faceCount,false);
		const unsigned maxSteps = mesh.faceCount * 2 + 100;
		const double epsilon = 1e-10;
		for (unsigned step = 0; step < maxSteps; ++step)
		{
			if (currentFace == sourcePoint.face)
			{
				reversePath.push_back({sourcePoint.point.x,sourcePoint.point.y,sourcePoint.point.z});
				break;
			}

			if (currentFace >= mesh.faceCount)
				return false;

			if (visitedFaces[currentFace])
				return false;

			visitedFaces[currentFace] = true;
			unsigned i0 = mesh.faces[currentFace * 3 + 0];
			unsigned i1 = mesh.faces[currentFace * 3 + 1];
			unsigned i2 = mesh.faces[currentFace * 3 + 2];
			const Vec3& p0 = mesh.vertices[i0];
			const Vec3& p1 = mesh.vertices[i1];
			const Vec3& p2 = mesh.vertices[i2];
			// --------------------------------------------------------
			// Gradient of phi on this triangle.
			// --------------------------------------------------------
			Vec3 grad =triangleGradient(p0,p1,p2,phi[i0],phi[i1],phi[i2]);
			double gradLength = length(grad);
			if (gradLength < 1e-14)
				return false;

				//Normally phi increases away from the source,
				//so move in -gradient direction.
			
			Vec3 direction = grad * (-1.0 / gradLength);
			// --------------------------------------------------------
			// Current barycentric coordinates.
			// --------------------------------------------------------
			double w0, w1, w2;
			if (!barycentric(currentPoint,p0,p1,p2,w0,w1,w2))
			{
				return false;
			}
			// Clamp tiny numerical errors.
			w0 = std::max(0.0, std::min(1.0, w0));
			w1 = std::max(0.0, std::min(1.0, w1));
			w2 = std::max(0.0, std::min(1.0, w2));
			double sum = w0 + w1 + w2;
			if (sum < 1e-20)
				return false;

			w0 /= sum;
			w1 /= sum;
			w2 /= sum;
			// --------------------------------------------------------
			// Barycentric gradients.
			// --------------------------------------------------------
			Vec3 normal =cross(p1 - p0,p2 - p0);
			double normal2 =dot(normal, normal);
			if (normal2 < 1e-20)
				return false;

			Vec3 gradW0 =cross(normal,p2 - p1) / normal2;
			Vec3 gradW1 =cross(normal,p0 - p2) / normal2;
			Vec3 gradW2 =cross(normal,p1 - p0) / normal2;
			double dw0 = dot(gradW0, direction);
			double dw1 = dot(gradW1, direction);
			double dw2 = dot(gradW2, direction);
			// --------------------------------------------------------
			// Find first triangle edge hit by the gradient ray.
			// --------------------------------------------------------
			double bestT =std::numeric_limits<double>::max();
			int crossedEdge = -1;

			if (dw0 < -epsilon)
			{
				double t = -w0 / dw0;

				if (t > epsilon && t < bestT)
				{
					bestT = t;
					crossedEdge = 0;
				}
			}
			if (dw1 < -epsilon)
			{
				double t = -w1 / dw1;

				if (t > epsilon && t < bestT)
				{
					bestT = t;
					crossedEdge = 1;
				}
			}
			if (dw2 < -epsilon)
			{
				double t = -w2 / dw2;

				if (t > epsilon && t < bestT)
				{
					bestT = t;
					crossedEdge = 2;
				}
			}
			if (crossedEdge < 0 || !std::isfinite(bestT))
			{
				return false;
			}

			Vec3 nextPoint =currentPoint +direction * bestT;
			// --------------------------------------------------------
			// Determine which edge was crossed.
			//
			// lambda0 = 0 -> edge (i1,i2)
			// lambda1 = 0 -> edge (i2,i0)
			// lambda2 = 0 -> edge (i0,i1)
			// --------------------------------------------------------

			unsigned edgeA;
			unsigned edgeB;

			if (crossedEdge == 0)
			{
				edgeA = i1;
				edgeB = i2;
			}
			else if (crossedEdge == 1)
			{
				edgeA = i2;
				edgeB = i0;
			}
			else
			{
				edgeA = i0;
				edgeB = i1;
			}

			unsigned nextFace = findNeighborFace(currentFace,edgeA,edgeB);
			if (nextFace == std::numeric_limits<unsigned>::max())
			{
				// Boundary.
				return false;
			}

			reversePath.push_back({nextPoint.x,nextPoint.y,nextPoint.z});
			currentPoint = nextPoint;
			currentFace = nextFace;
		}
		// ------------------------------------------------------------
		// Did we actually reach the source triangle?
		// ------------------------------------------------------------
		if (currentFace != sourcePoint.face)
			return false;
		// ------------------------------------------------------------
		// reverse target -> source into source -> target.
		// ------------------------------------------------------------
		std::reverse(reversePath.begin(),reversePath.end());
		path = std::move(reversePath);
		return path.size() >= 2;
	}
	*/

	// working but makes a strange angle from th epicked point to the start of the path	
	static bool reconstructHeatPath(const HeatMesh& mesh, unsigned source, unsigned target, const std::vector<double>& phi, std::vector<PathPoint>& path)
	{
		path.clear();
		if (source >= mesh.vertexCount ||target >= mesh.vertexCount ||phi.size() != mesh.vertexCount)
		{
			return false;
		}
		if (source == target)
		{
			const Vec3& p =mesh.vertices[source];
			path.push_back({p.x,p.y,p.z});
			return true;
		}
		//Determine the direction in which phi leads toward source.
		const double sourcePhi =phi[source];
		const double targetPhi =phi[target];

		if (!std::isfinite(sourcePhi) ||!std::isfinite(targetPhi))
		{
			return false;
		}
		/*
			Normally phi should increase away from the source.
			Therefore:
			targetPhi > sourcePhi -> move toward smaller phi
			targetPhi < sourcePhi-> move toward larger phi
			We keep this generic because our Laplacian/divergence
			convention may produce the opposite sign.
		*/
		const bool moveToLowerPhi = targetPhi > sourcePhi;
		unsigned current = target;
		std::vector<bool> visited(mesh.vertexCount,false);
		path.reserve(mesh.vertexCount);
		/*
			--------------------------------------------------------
			Stage 1:
			Follow the Heat/Poisson scalar field.
		*/
		const unsigned maxGradientSteps =mesh.vertexCount * 2;
		for (unsigned step = 0;step < maxGradientSteps;++step)
		{
			const Vec3& currentPoint =mesh.vertices[current];
			path.push_back({currentPoint.x,currentPoint.y,currentPoint.z});

			if (current == source)
			{
				std::reverse(path.begin(),path.end());
				return true;
			}

			if (visited[current])
				break;

			visited[current] = true;
			const double currentPhi = phi[current];
			unsigned bestNeighbor = current;
			double bestPhi = moveToLowerPhi ? std::numeric_limits<double>::max() : -std::numeric_limits<double>::max();
			bool foundGradientNeighbor =false;

			//Find the neighbor that makes the strongest movement toward the source in phi.
			for (unsigned neighbor :mesh.adjacency[current])
			{
				if (neighbor >= mesh.vertexCount || visited[neighbor])
				{
					continue;
				}
				const double neighborPhi =phi[neighbor];
				if (!std::isfinite(neighborPhi))
					continue;

				if (moveToLowerPhi)
				{ //We want smaller phi.
					if (neighborPhi < currentPhi &&neighborPhi < bestPhi)
					{
						bestPhi =neighborPhi;
						bestNeighbor =neighbor;
						foundGradientNeighbor =true;
					}
				}
				else
				{ //We want larger phi.				
					if (neighborPhi > currentPhi && neighborPhi > bestPhi)
					{
						bestPhi =neighborPhi;
						bestNeighbor =neighbor;
						foundGradientNeighbor =true;
					}
				}
			}

			if (foundGradientNeighbor)
			{
				current = bestNeighbor;
				continue;
			}
			/*
				----------------------------------------------------
				The Heat field has reached a local plateau/minimum.Do NOT fail.
				Fall back to a graph shortest path from hereto the source.
				----------------------------------------------------
			*/
			break;
		}
		/*
			--------------------------------------------------------
			Stage 2: Robust fallback.
			Find a shortest path over the mesh edges from the current vertex to the source.
			This guarantees that a valid surface-connected path can still be returned when the discrete phi field
			has a local plateau.
			--------------------------------------------------------
		*/
		const unsigned fallbackStart = current;
		const unsigned n = mesh.vertexCount;
		std::vector<double> distance(n,std::numeric_limits<double>::max());
		std::vector<unsigned> previous(n,std::numeric_limits<unsigned>::max());
		std::vector<bool> used(n,false);
		distance[fallbackStart] = 0.0;

		/*
			Simple O(V^2) Dijkstra.
			For 7637 vertices this is perfectly acceptable as
			a fallback and avoids adding another dependency.
		*/
		for (unsigned iteration = 0;iteration < n;++iteration)
		{
			unsigned currentNode = std::numeric_limits<unsigned>::max();
			double bestDistance =std::numeric_limits<double>::max();

			for (unsigned i = 0; i < n; ++i)
			{
				if (used[i])
					continue;

				if (distance[i] < bestDistance)
				{
					bestDistance =distance[i];
					currentNode =i;
				}
			}

			if (currentNode == std::numeric_limits<unsigned>::max())
			{
				break;
			}

			used[currentNode] = true;

			if (currentNode == source)
				break;

			const Vec3& a = mesh.vertices[currentNode];

			for (unsigned neighbor : mesh.adjacency[currentNode])
			{
				if (neighbor >= n ||used[neighbor])
				{
					continue;
				}

				const Vec3& b = mesh.vertices[neighbor];
				const double dx = b.x - a.x;
				const double dy = b.y - a.y;
				const double dz = b.z - a.z;
				const double edgeLength = std::sqrt(dx * dx +dy * dy +dz * dz);

				if (!std::isfinite(edgeLength) ||edgeLength <= 0.0)
				{
					continue;
				}

				const double candidate =distance[currentNode] +edgeLength;

				if (candidate <distance[neighbor])
				{
					distance[neighbor] =candidate;
					previous[neighbor] =currentNode;
				}
			}
		}

		if (source != fallbackStart &&previous[source] ==std::numeric_limits<unsigned>::max())
		{
			return false;
		}

		//Reconstruct fallback path: source -> ... -> fallbackStart
		std::vector<unsigned> fallbackVertices;
		unsigned node = source;
		while (true)
		{
			fallbackVertices.push_back(node);
			if (node == fallbackStart)
				break;

			unsigned previousNode =previous[node];
			if (previousNode ==std::numeric_limits<unsigned>::max())
			{
				return false;
			}
			node = previousNode;
		}
		/*
			fallbackVertices is: source -> ... -> fallbackStart
			Our existing path is: target -> ... -> fallbackStart
			Remove the duplicate fallbackStart,append the fallback path,then reverse everything.
		*/

		if (!path.empty())
		{
			path.pop_back();
		}

		for (auto it =fallbackVertices.rbegin();it != fallbackVertices.rend();++it)
		{
			const Vec3& p = mesh.vertices[*it];
			path.push_back({p.x,p.y,p.z});
		}

		if (path.size() < 2)
			return false;

		std::reverse(path.begin(),path.end());
		std::cerr
			<< "[HEAT] path reconstructed"
			<< " vertices="
			<< path.size()
			<< std::endl;

		return true;
	}
	
	//continuous phi interpolation
	static double interpolatePhi(const std::vector<double>& phi, const SurfacePoint& point)
	{
		if (point.i0 >= phi.size() ||point.i1 >= phi.size() ||point.i2 >= phi.size())
		{
			return std::numeric_limits<double>::quiet_NaN();
		}
		return
			point.w0 * phi[point.i0] + point.w1 * phi[point.i1] + point.w2 * phi[point.i2];
	}

	// ============================================================
	// Main Heat Method query

static HeatResult calculateHeatDistance(HeatMesh& mesh,const SurfacePoint& sourcePoint,const SurfacePoint& targetPoint)
{
	HeatResult result;

	std::vector<double> u;
	std::vector<double> divergence;
	std::vector<double> phi;

	// Choose the source triangle vertex closest to the actual source point.
	unsigned sourceAnchor = sourcePoint.i0;

	Vec3 sourceDelta0 =sourcePoint.point - mesh.vertices[sourcePoint.i0];
	Vec3 sourceDelta1 =sourcePoint.point - mesh.vertices[sourcePoint.i1];
	Vec3 sourceDelta2 =sourcePoint.point - mesh.vertices[sourcePoint.i2];

	double d0 = dot(sourceDelta0, sourceDelta0);
	double d1 = dot(sourceDelta1, sourceDelta1);
	double d2 = dot(sourceDelta2, sourceDelta2);

	if (d1 < d0 && d1 <= d2)
		sourceAnchor = sourcePoint.i1;
	else if (d2 < d0 && d2 < d1)
		sourceAnchor = sourcePoint.i2;

	// Step 1: heat diffusion from the actual surface point.
	if (!solveHeat(mesh,sourcePoint.i0,sourcePoint.i1,sourcePoint.i2,sourcePoint.w0,sourcePoint.w1,sourcePoint.w2,u))
	{
		result.error = "Heat diffusion solve failed.";
		return result;
	}
	// Step 2: normalized vector field + divergence.
	/*if (!computeDivergence(mesh, u, divergence))
	{
		result.error = "Heat divergence computation failed.";
		return result;
	}*/
	computeDivergence(mesh, u, divergence);

	// Step 3: Poisson solve.
	if (!solvePoisson(mesh, divergence, sourceAnchor, phi))
	{
		result.error = "Heat Poisson solve failed.";
		return result;
	}

	// Choose the target triangle vertex with the highest heat distance.
	unsigned targetAnchor = targetPoint.i0;
	/*
	if (phi[targetPoint.i1] > phi[targetAnchor])
		targetAnchor = targetPoint.i1;

	if (phi[targetPoint.i2] > phi[targetAnchor])
		targetAnchor = targetPoint.i2;

	// Interpolate the scalar field at the actual surface points.
	const double sourcePhi =interpolatePhi(phi, sourcePoint);
	const double targetPhi =interpolatePhi(phi, targetPoint);

	double distance = std::abs(targetPhi - sourcePhi);

	if (!std::isfinite(distance))
	{
		result.error = "Heat distance is invalid.";
		return result;
	}

	// Reconstruct vertex path.
	if (!reconstructHeatPath(mesh,sourceAnchor,targetAnchor,phi,result.path))
	{
		result.error = "Heat path reconstruction failed.";
		return result;
	}

	// The reconstructed path uses vertices.
	// Replace its endpoints with the actual selected surface points.
	std::vector<PathPoint> finalPath;

	finalPath.reserve(result.path.size() + 2);

	finalPath.push_back({sourcePoint.point.x,sourcePoint.point.y,sourcePoint.point.z});

	for (const auto& point : result.path)
	{
		finalPath.push_back(point);
	}

	finalPath.push_back({targetPoint.point.x,targetPoint.point.y,targetPoint.point.z});

	result.path = std::move(finalPath);

	result.sourceSnapDistance =std::sqrt(sourcePoint.distance2);

	result.targetSnapDistance =std::sqrt(targetPoint.distance2);

	result.status = true;
	result.distance = distance;

	return result;
	*/

	Vec3 targetDelta0 = targetPoint.point - mesh.vertices[targetPoint.i0];
	Vec3 targetDelta1 = targetPoint.point - mesh.vertices[targetPoint.i1];
	Vec3 targetDelta2 = targetPoint.point - mesh.vertices[targetPoint.i2];

	double targetD0 = dot(targetDelta0, targetDelta0);
	double targetD1 = dot(targetDelta1, targetDelta1);
	double targetD2 = dot(targetDelta2, targetDelta2);

	if (targetD1 < targetD0 && targetD1 <= targetD2)
	{
		targetAnchor = targetPoint.i1;
	}
	else if (targetD2 < targetD0 && targetD2 < targetD1)
	{
		targetAnchor = targetPoint.i2;
	}
	// ------------------------------------------------------------
	// Distance at actual surface points
	// ------------------------------------------------------------
	const double sourcePhi = interpolatePhi(phi, sourcePoint);
	const double targetPhi = interpolatePhi(phi, targetPoint);
	double distance = std::abs(targetPhi - sourcePhi);

	if (!std::isfinite(distance))
	{
		result.error = "Heat distance is invalid.";
		return result;
	}
	// ------------------------------------------------------------
	// Reconstruct vertex path
	// ------------------------------------------------------------
	
	//if (!reconstructHeatPath(mesh, sourcePoint, targetPoint, phi, result.path))
	if (!reconstructHeatPath(mesh, sourceAnchor, targetAnchor, phi, result.path))
	{
		result.error = "Heat path reconstruction failed.";
		return result;
	}
	// ------------------------------------------------------------
	// Replace vertex endpoints with the actual picked points.
	// ------------------------------------------------------------
	std::vector<PathPoint> finalPath;
	finalPath.reserve(result.path.size() + 2);

	finalPath.push_back({sourcePoint.point.x,sourcePoint.point.y,sourcePoint.point.z});

	for (const auto& point : result.path)
	{
		finalPath.push_back(point);
	}

	finalPath.push_back({targetPoint.point.x,targetPoint.point.y,targetPoint.point.z});

	result.path = std::move(finalPath);
	

	result.sourceSnapDistance = std::sqrt(sourcePoint.distance2);
	result.targetSnapDistance = std::sqrt(targetPoint.distance2);
	result.status = true;
	result.distance = distance;

	return result;
}

} // namespace


// ============================================================
// Public API
// ============================================================
bool loadHeatMesh(const std::string& model_id, const std::vector<double>& vertices, const std::vector<unsigned>& faces)
{
	if (vertices.empty())
		return false;

	if (faces.empty())
		return false;

	if (vertices.size() % 3 != 0)
		return false;

	if (faces.size() % 3 != 0)
		return false;

	HeatMesh mesh;
	mesh.vertices.reserve(vertices.size() / 3);

	for (std::size_t i = 0;i < vertices.size();i += 3)
	{
		mesh.vertices.emplace_back(vertices[i],vertices[i + 1],vertices[i + 2]);
	}

	mesh.faces = faces;
	if (!buildHeatMesh(mesh))
		return false;

	heatDB[model_id] = std::move(mesh);
	std::cout
		<< "[HEAT] loaded mesh "
		<< model_id
		<< " vertices="
		<< vertices.size() / 3
		<< " faces="
		<< faces.size() / 3
		<< " meanEdge="
		<< heatDB[model_id].meanEdgeLength
		<< " t="
		<< heatDB[model_id].timeStep
		<< std::endl;

	return true;
}


HeatResult heatQuery(const std::string& model_id,double x1,double y1,double z1,double x2,double y2,double z2)
{
	HeatResult result;

	auto it = heatDB.find(model_id);

	if (it == heatDB.end())
	{
		result.error ="heat mesh not found";
		return result;
	}

	HeatMesh& mesh = it->second;

	/*
	unsigned source = findNearestVertex(mesh,x1,y1,z1);
	unsigned target = findNearestVertex(mesh,x2,y2,z2);
	std::cout
		<< "[HEAT] query "
		<< "source=" << source
		<< " target=" << target
		<< std::endl;
	return calculateHeatDistance(mesh,source,target);
	*/
	SurfacePoint sourcePoint = findClosestSurfacePoint(mesh,x1,y1,z1);
	SurfacePoint targetPoint = findClosestSurfacePoint(mesh,x2,y2,z2);

	if (sourcePoint.distance2 == std::numeric_limits<double>::max() || targetPoint.distance2 == std::numeric_limits<double>::max())
	{
		result.error = "could not find surface point";
		return result;
	}

	std::cout
		<< "[HEAT] query"
		<< " sourceFace=" << sourcePoint.face
		<< " targetFace=" << targetPoint.face
		<< " sourceSnap="
		<< std::sqrt(sourcePoint.distance2)
		<< " targetSnap="
		<< std::sqrt(targetPoint.distance2)
		<< std::endl;

	std::cout
		<< "[HEAT] source barycentric="
		<< sourcePoint.w0 << ","
		<< sourcePoint.w1 << ","
		<< sourcePoint.w2
		<< std::endl;

	std::cout
		<< "[HEAT] target barycentric="
		<< targetPoint.w0 << ","
		<< targetPoint.w1 << ","
		<< targetPoint.w2
		<< std::endl;

	return calculateHeatDistance(mesh,sourcePoint,targetPoint);
}