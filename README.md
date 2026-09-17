# THOTH Web App

<p align="center">
    <a href = "https://github.com/TEXTaiLES/thoth" target="_blank">
        <img src="appicon.png" alt="THOTH" width="250"/>
    </a>
</p>

THOTH is a web app developed as part of the [TEXTaiLES](https://www.echoes-eccch.eu/textailes/) toolbox as a dedicated 3D viewer and annotator.

THOTH is based on the [ATON Framework](https://osiris.itabc.cnr.it/aton/), a 3D viewer designed for uses in cultural heritage. Both THOTH and ATON are in turn built on [Node.js](https://nodejs.org/en) using [Three.js](https://threejs.org/).

The currently verified ATON revision is `5a7582d7c92d44066f50feddcb3576ed1027d32e` (ATON `3.0.3-18-g5a7582d`).

Measurements support Euclidean distance, mesh-edge approximate geodesics, and exact surface geodesics through the native Kirsanov MMP addon.

<p align="center">
    <a href = "https://www.echoes-eccch.eu/textailes/" target="_blank">
        <img src="res/Logo-Textailes-Colour-RGB-Hor.png" alt="TEXTaiLES" width="800"/>
    </a>
</p>

## Status and releases

THOTH is under active development. `main` is the default branch for released versions; `dev` integrates work for future releases. Consult the [releases](https://github.com/TEXTaiLES/thoth/releases) and [changelog](CHANGELOG.md) for published versions and known limitations.

## Installation

Supported deployment methods are native ATON, PM2-managed native ATON, local Docker, and HESTIA Docker. See the [deployment guide](docs/DEPLOYMENT.md) for prerequisites, native-addon build steps, persistence, configuration, and troubleshooting.

For native deployment, clone ATON and select the documented compatible revision:

```sh
git clone https://github.com/phoenixbf/aton.git
cd aton
git checkout 5a7582d7c92d44066f50feddcb3576ed1027d32e
git clone --branch main https://github.com/TEXTaiLES/thoth.git wapps/thoth
```

Then follow the native installation steps in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), including the exact-geodesic addon and gateway installation if using exact surface measurements. Native exact geodesics require Python, a C++17 compiler, and the platform build tools used by `node-gyp` in addition to Node.js.

Developers contributing to THOTH should instead work from `dev` as described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Opening THOTH

Open the landing page at:

```
{base_url}/a/thoth/
```

Authenticated users can manage their local ATON scenes at:

```
{base_url}/a/thoth/myscenes/
```

HESTIA deployments support scene creation there, but do not present HESTIA's
global scene list as a personal list and do not offer scene deletion.

To open a scene using the THOTH web app, open the following url on your web browser.

```
{base_url}/a/thoth/?scene_id={scene_id}
```

where `base_url` is the ATON base URL and `scene_id` is the scene identifier. The default base URL is [http://localhost:8080](http://localhost:8080).

You can create a scene from the ATON front end (Shu) or through the ATON REST API; consult the API documentation for your selected [ATON revision](https://github.com/phoenixbf/aton/tree/5a7582d7c92d44066f50feddcb3576ed1027d32e).

## Docker and HESTIA deployment

From the THOTH repository root, local Docker is the default container deployment:

```sh
docker compose up --build -d
```

Open [http://localhost:8054/a/thoth/](http://localhost:8054/a/thoth/) for the default local Docker configuration. It uses ATON's local API and authentication. HESTIA integration is selected explicitly with `docker-compose.hestia.yml` and provides separate EGI and HESTIA Portal login buttons.

Deployment configuration lives under `config/`. The committed `deployment.json` selects `local.json`; HESTIA Docker overrides that selector at runtime to select `hestia.json`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for native ATON, PM2, local Docker, HESTIA Docker, environment variables, persistence, and troubleshooting.

## Documentation

Additional documentation can be found here: 

[https://textailes.github.io/thoth-documentation/](https://textailes.github.io/thoth-documentation/)

## Contributing and support

Bug reports, documentation improvements, usability feedback, and focused code contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the `dev` workflow and validation expectations, and [SUPPORT.md](SUPPORT.md) for support and reporting guidance. Use the [issue forms](https://github.com/TEXTaiLES/thoth/issues/new/choose) for ordinary bug reports and feature requests.

Maintenance and review depend on available resources. Response times, feature implementation, and a fixed period of post-project maintenance are not guaranteed. Hosted-service arrangements may differ from source-repository maintenance.

## Citation

If you use this software, please cite THOTH and ATON. [CITATION.cff](CITATION.cff) provides machine-readable software metadata. Include the THOTH release tag or commit used in your work. The software entry below does not assert a released version:

```bibtex
@software{Athena_Research_Center_THOTH_3D_Annotator_2025,
author  = {{Athena Research Center}},
title   = {{THOTH 3D Viewer and Annotator}},
url     = {https://github.com/TEXTaiLES/THOTH},
year    = {2025}
}
```

```bibtex
@article{fanini2021aton,
  title     = {ATON: An Open-Source Framework for Creating Immersive, Collaborative and Liquid Web-Apps for Cultural Heritage},
  author    = {Fanini, Bruno and Ferdani, Daniele and Demetrescu, Emanuel and Berto, Simone and d’Annibale, Enzo},
  journal   = {Applied Sciences},
  volume    = {11},
  number    = {22},
  pages     = {11062},
  year      = {2021},
  publisher = {Multidisciplinary Digital Publishing Institute}
}
```

## License

The repository includes the GNU General Public License version 3. See [LICENSE](LICENSE) for the license text and preserve applicable third-party notices. Models, images, textures, annotations, and other collection material may have separate rights and licenses; do not assume that the software license authorizes their redistribution.

## Funding acknowledgement

THOTH was developed as part of the TEXTaiLES project, funded by the European Union's Horizon Europe research and innovation programme under Grant Agreement No. 101158328.

Funded by the European Union. Views and opinions expressed are however those of the author(s) only and do not necessarily reflect those of the European Union or the European Research Executive Agency (REA). Neither the European Union nor the granting authority can be held responsible for them.
