#include <napi.h>

#include "geodesic.h"


Napi::Value LoadMesh(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();

	if (info.Length() != 3)
		throw Napi::Error::New(env, "Expected model_id, vertices, faces");


	std::string model_id =info[0].As<Napi::String>().Utf8Value();
	std::vector<double> vertices;

	Napi::Array verts = info[1].As<Napi::Array>();

	for (uint32_t i = 0; i < verts.Length(); i++)
	{
		vertices.push_back(verts.Get(i).As<Napi::Number>().DoubleValue());
	}


	std::vector<unsigned> faces;

	Napi::Array fs = info[2].As<Napi::Array>();

	for (uint32_t i = 0; i < fs.Length(); i++)
	{
		faces.push_back(fs.Get(i).As<Napi::Number>().Uint32Value());
	}

	bool ok = loadMesh(model_id,vertices,faces);

	return Napi::Boolean::New(env, ok);
}

Napi::Value Query(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();

	if (info.Length() != 7)
	{
		Napi::TypeError::New(env, "Expected 7 arguments")
			.ThrowAsJavaScriptException();
		return env.Null();
	}

	std::string model_id = info[0].As<Napi::String>().Utf8Value();

	double x1 = info[1].As<Napi::Number>().DoubleValue();
	double y1 = info[2].As<Napi::Number>().DoubleValue();
	double z1 = info[3].As<Napi::Number>().DoubleValue();

	double x2 = info[4].As<Napi::Number>().DoubleValue();
	double y2 = info[5].As<Napi::Number>().DoubleValue();
	double z2 = info[6].As<Napi::Number>().DoubleValue();

	QueryResult r = query(model_id, x1, y1, z1, x2, y2, z2);

	Napi::Object result = Napi::Object::New(env);

	result.Set("status", r.status);
	result.Set("distance", r.distance);

	Napi::Array path = Napi::Array::New(env, r.path.size());

	for (size_t i = 0; i < r.path.size(); i++)
	{
		Napi::Object p = Napi::Object::New(env);

		p.Set("x", r.path[i].x);
		p.Set("y", r.path[i].y);
		p.Set("z", r.path[i].z);

		path.Set(i, p);
	}

	result.Set("path", path);

	return result;
}
/*
Napi::Value Query(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();
	Napi::Object o =info[0].As<Napi::Object>();

	std::string model_id =o.Get("model_id").As<Napi::String>().Utf8Value();

	double x1 = o.Get("x1").As<Napi::Number>();
	double y1 = o.Get("y1").As<Napi::Number>();
	double z1 = o.Get("z1").As<Napi::Number>();

	double x2 = o.Get("x2").As<Napi::Number>();
	double y2 = o.Get("y2").As<Napi::Number>();
	double z2 = o.Get("z2").As<Napi::Number>();
	QueryResult r =query(model_id,x1, y1, z1,x2, y2, z2);
	Napi::Object result = Napi::Object::New(env);

	result.Set("status",Napi::Boolean::New(env, r.status));
	result.Set("distance",Napi::Number::New(env, r.distance));
	Napi::Array path =Napi::Array::New(env);

	for (size_t i = 0; i < r.path.size(); i++)
	{
		Napi::Object p =Napi::Object::New(env);

		p.Set("x",r.path[i].x);
		p.Set("y",r.path[i].y);
		p.Set("z",r.path[i].z);
		path[i] = p;
	}
	result.Set("path",path);
	return result;
}
*/
Napi::Object Init(Napi::Env env,Napi::Object exports)
{
	exports.Set("loadMesh",Napi::Function::New(
			env,
			LoadMesh
		)
	);
	exports.Set(
		"query",
		Napi::Function::New(
			env,
			Query
		)
	);
	return exports;
}
NODE_API_MODULE(geodesic_addon,Init)