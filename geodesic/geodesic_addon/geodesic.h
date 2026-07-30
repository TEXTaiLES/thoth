#pragma once

#include <string>
#include <vector>

struct PathPoint
{
	double x;
	double y;
	double z;
};

struct QueryResult
{
	bool status = false;
	double distance = 0.0;
	std::string error;
	std::vector<PathPoint> path;
};


bool loadMesh(
	std::string& model_id,
	std::vector<double>& vertices,
	std::vector<unsigned>& faces
);


QueryResult query(
	std::string& model_id,
	double x1,
	double y1,
	double z1,
	double x2,
	double y2,
	double z2
);