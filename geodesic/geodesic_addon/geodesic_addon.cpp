#include <cmath>
#include <string>
#include <stdexcept>
#include <vector>

#include <napi.h>

#include "geodesic.h"

namespace
{
std::vector<double> readVertices(const Napi::Array& values)
{
    std::vector<double> result;
    result.reserve(values.Length());
    for (uint32_t index = 0; index < values.Length(); ++index)
    {
        const Napi::Value value = values.Get(index);
        if (!value.IsNumber()) throw std::invalid_argument("vertices must contain only numbers");
        result.push_back(value.As<Napi::Number>().DoubleValue());
    }
    return result;
}

std::vector<unsigned> readFaces(const Napi::Array& values)
{
    std::vector<unsigned> result;
    result.reserve(values.Length());
    for (uint32_t index = 0; index < values.Length(); ++index)
    {
        const Napi::Value value = values.Get(index);
        if (!value.IsNumber()) throw std::invalid_argument("faces must contain only numbers");
        const double numericValue = value.As<Napi::Number>().DoubleValue();
        if (!std::isfinite(numericValue) || numericValue < 0 || std::floor(numericValue) != numericValue)
        {
            throw std::invalid_argument("faces must contain only non-negative integer indices");
        }
        result.push_back(static_cast<unsigned>(numericValue));
    }
    return result;
}

Napi::Value loadMeshBinding(const Napi::CallbackInfo& info)
{
    const Napi::Env environment = info.Env();
    try
    {
        if (
            info.Length() != 3 ||
            !info[0].IsString() ||
            !info[1].IsArray() ||
            !info[2].IsArray()
        ) throw std::invalid_argument("expected mesh_id, vertices, faces");

        const std::string meshId = info[0].As<Napi::String>().Utf8Value();
        const std::vector<double> vertices = readVertices(info[1].As<Napi::Array>());
        const std::vector<unsigned> faces = readFaces(info[2].As<Napi::Array>());
        return Napi::Boolean::New(environment, loadMesh(meshId, vertices, faces));
    }
    catch (const std::exception& error)
    {
        Napi::TypeError::New(environment, error.what()).ThrowAsJavaScriptException();
        return environment.Null();
    }
}

Napi::Value queryBinding(const Napi::CallbackInfo& info)
{
    const Napi::Env environment = info.Env();
    try
    {
        if (info.Length() != 7 || !info[0].IsString())
        {
            throw std::invalid_argument("expected mesh_id and six coordinates");
        }
        for (std::size_t index = 1; index < 7; ++index)
        {
            if (!info[index].IsNumber()) throw std::invalid_argument("coordinates must be numbers");
        }

        const std::string meshId = info[0].As<Napi::String>().Utf8Value();
        const QueryResult queryResult = query(
            meshId,
            info[1].As<Napi::Number>().DoubleValue(),
            info[2].As<Napi::Number>().DoubleValue(),
            info[3].As<Napi::Number>().DoubleValue(),
            info[4].As<Napi::Number>().DoubleValue(),
            info[5].As<Napi::Number>().DoubleValue(),
            info[6].As<Napi::Number>().DoubleValue()
        );

        Napi::Object result = Napi::Object::New(environment);
        result.Set("status", queryResult.status);
        result.Set("distance", queryResult.distance);
        result.Set("error", queryResult.error);
        Napi::Array path = Napi::Array::New(environment, queryResult.path.size());
        for (std::size_t index = 0; index < queryResult.path.size(); ++index)
        {
            Napi::Object point = Napi::Object::New(environment);
            point.Set("x", queryResult.path[index].x);
            point.Set("y", queryResult.path[index].y);
            point.Set("z", queryResult.path[index].z);
            path.Set(index, point);
        }
        result.Set("path", path);
        return result;
    }
    catch (const std::exception& error)
    {
        Napi::TypeError::New(environment, error.what()).ThrowAsJavaScriptException();
        return environment.Null();
    }
}
}

Napi::Object initialize(Napi::Env environment, Napi::Object exports)
{
    exports.Set("loadMesh", Napi::Function::New(environment, loadMeshBinding));
    exports.Set("query", Napi::Function::New(environment, queryBinding));
    return exports;
}

NODE_API_MODULE(geodesic_addon, initialize)
