#pragma once

#include <string>
#include <vector>

#include "geodesic.h"

struct HeatResult
{
	bool status = false;
	double distance = 0.0;
	std::string error;
	std::vector<PathPoint> path;

};

bool loadHeatMesh(
	const std::string& model_id,
	const std::vector<double>& vertices,
	const std::vector<unsigned>& faces
);

HeatResult heatQuery(
	const std::string& model_id,
	double x1,
	double y1,
	double z1,
	double x2,
	double y2,
	double z2
);