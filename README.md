# THOTH Web App

<p align="center">
    <a href = "https://github.com/Xenobii/thoth" target="_blank">
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

## Basic Installation

### Step 1
The only pre-requisite to run your own instance of ATON on your machine is [Node.js](https://nodejs.org/). You can install it on Windows, Linux, and Mac OS.

### Step 2
Download a copy of ATON framework from [GitHub](https://github.com/phoenixbf/aton) or grab the zip package. If you are not so familiar with git, dont worry: just grab the [zip](https://codeload.github.com/phoenixbf/aton/zip/refs/heads/master) and extract somewhere on your machine. In general however, the best solution is to git clone the repository: this allows you to periodically update your instance without messing with your custom configuration.

To clone the repository using the terminal run:
```
git clone https://github.com/phoenixbf/aton.git
``` 


### Step 3
Download a copy of THOTH from [Github](https://github.com/Xenobii/thoth) and place it in the /wapps folder located directly inside the aton folder. Similarly to ATON, either download the [zip](https://github.com/Xenobii/thoth) or clone the repository inside the wapps folder. 
```
git clone https://github.com/Xenobii/thoth.git
```

### Step 4
Launch **setup.bat** (Windows) or execute **setup.sh** (Linux and Mac OS) from the ATON main folder. Alternatively, open your terminal, go to the main ATON folder (`cd /your/ATON/folder/`) and just type this command:

```
npm install
```

This installs and updates all node.js modules required by ATON.

### Step 5
Once you have installed all the above prerequisites, you can launch the main ATON service by launching **quickstart.bat** (Windows) or **quickstart.sh** (Linux or Mac OS). Alternatively, you can run the following command from your terminal:
```
npm start
```

This will run and deploy a basic instance of ATON on your machine.

To verify everything runs properly, navigate to [http://localhost:8080/](http://localhost:8080/) on your web browser. 

## Opening a scene with THOTH

To open a scene using the THOTH web app, open the following url on your web browser.

```
{base_url}/a/thoth/?scene_id={scene_id}
```

where `base_url` is the ATON base URL and `scene_id` is the scene identifier. The default base URL is [http://localhost:8080](http://localhost:8080).

You can create a scene from the ATON front end (Shu) or through a post request through the [ATON REST API](../api/rest.md).

## Docker and HESTIA deployment

Local Docker is the default container deployment:

```sh
docker compose up --build -d
```

It uses ATON's local API and authentication. HESTIA integration is selected explicitly with `docker-compose.hestia.yml` and provides separate EGI and HESTIA Portal login buttons.

Deployment configuration lives under `config/`. The committed `deployment.json` selects `local.json`; HESTIA Docker overrides that selector at runtime to select `hestia.json`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for native ATON, PM2, local Docker, HESTIA Docker, environment variables, persistence, and troubleshooting.

## Documentation

Additional documentation can be found here: 

[https://textailes.github.io/thoth-documentation/](https://textailes.github.io/thoth-documentation/)

## Citation

If you use this software, please cite THOTH and ATON using the following BibTeX entries:

```bibtex
@software{Athena_Research_Center_THOTH_3D_Annotator_2025,
author  = {{Athena Research Center}},
license = {GNU},
month   = nov,
title   = {{THOTH 3D Viewer and Annotator}},
url     = {https://github.com/TEXTaiLES/THOTH},
version = {0.1.0},
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

This project is licensed under the GNU License. For more details, please refer to the [LICENSE](https://www.gnu.org/licenses/gpl-3.0.en.html).
