# THOTH Refactor

I want to refactor the THOTH codebase to scale and generalize better.
The end-goal is a more robust framework which operates on scene objects that follow the structure defined un the scene structure folder - scalable higherarchical objects. I also want to have improved history and collaborative support.

## Implementation Details

### Main
The main coordination of the web app, including setup, import+export and authentication will be done from the main.js script. The main function will also contain general utils for visualization and scene updates.

#### App setup
- Setup the app similarly to ATON's hathor front end + any additional necessary initializations.
- Each different feature (as defined bellow) will have its own setup routine, which will be called when the main app has been initialized.

#### Authentication
Specific functionalities will be locked when a user is not authenticated. These include all functions related to:
- Importing models
- Exporting changes
- Adding/modifying semantic annotations
- Adding/modifying selections
- Adding/modifying measurements
- Modifying model metadata
Logging in will unlock all features and functionalities. Logging out will refresh the page after a warning (for compatibility reasons) and log out the user.
All Import/Export endpoints will pass through a checkAuth function, declining the request if the user is not authenticated. The checkAuth function can be the native ATON one.

#### Models
A scene can contain multiple models. Each will be treated within the scene as a node with attributes according to the structure defined in scene_structure/model.
- All models will be loaded once setup has been completed. Their meshes and attributes will be loaded through the corresponding modules, defined later.

#### Collaborative
If a scene is marked as collaborative, changes done by a user will be broadcasted to all other users via ATON's Photon service. This includes all changes done to the scene by any user:
- Adding/removing models
- Managing semantic annoations/selections/measurements
- Managing artefact details, metadata, sensors
- Applying transformations

#### History
All changes done to a scene will be reversible via a history stack (undo, redo). This inlcudes:
- Adding/removing models
- Managing semantic annoations/selections/measurements
- Managing artefact details, metadata, sensors
- Applying transformations
Importantly, history stacks are store per user. This means that one user cannot interact with the changes done by another through undoing/redoing. To minimize conflicts, do no just replace the existing scene information for all users when a change is applied - resolve the difference internally and project it OR project the scene and resolve it from the other users' end.

#### Export
On scene export, the model nodes will be added to the scene object along with all their related attributes, matching the structure defined in scene_structure.

### Artefact
All artefact-related functions will be placed in js/artefacts.js. This will contain:
- Artefact retrieval endpoints (GET).
- Scene parser for loading the model + its details (description, name etc).
- Utilities regarding the parsing attributes of the artefact.
- Management of the corresponding ui elements.
This is one of the few parts that the user can not directly modify per model (only view).

### Metadata
All metadata-related functions will be placed in js/metadata.js. This includes:
- Schema retrieval endpoints (GET). This retrieves the available schemas and their attributes as defined under scene_structure/model/metadata/metadata.json.schema.
- Schema parsing utilities.
- Attribute generation + modification utilities.
- Metadata export endpoints (GET, PUT). This gets/puts only the metadata for a specific artefact as objects defined by the selected schema.
- Management of the corresponding ui elements.
The attribute generation will be dynamic. An example metadata structure is placed under scene_structure/model/metadata/puc_schema.json.

### Annotations
All annotation-related functions will be placed in js/annotations.js. We define as annotation modalities selections, semantic annoations and measurements. All 3 share common structure and therefore can have common internal API. The difference between the modalities are specific changes which will be handled by separate scripts. The functions here contain:
- Management of name, description, related rgb images, related artefacts (connection to artefacts.js), visibility.
- Endpoints for retrieving rgb and multispectral images (GET).

### Selections
One of the annotation modalities. All geometry-level selection functions will be placed in js/selections.js. This includes:
- Selection io parsing utilities.
- All selection tool function (brush/eraser/lasso). The tools will have the same internal API.
- Mesh-level geometry update utilities for face selection and visualization.
- Management of the corresponding ui elements.
Each selection will contain its own set of faces per object as defined in scene_structure/model/selection/selection.json

### Measurements
One of the annotation modalities. All measurement-related functions will be placed in js/measurements.js. This includes:
- Measurement io parsing utilities.
- Functions for measurement point placement.
- Measurement functions for distance computation (eucledian + geodesic).
- Management of the corresponding ui elements.
Each measurement will contain its details per object as defined in scene_structure/model/measurement/measurement.json

### Semantic annotations
One of the annotation modalities. All semantic annotation-related functions will be placed in js/semantic_annotations.js. This includes:
- Semantic annotation io parsing utilities.
- Functions for semantic point placement.
- Management of the corresponding ui elements.
Each semantic annotation will contain its details per object as defined in scene_structure/model/semantic_annotation/semantic_annotation.json

### Transforms
All mesh transform functions will be placed in js/transforms. This includes:
- Transform io parsing utilities.
- Functions for translation/rotation/scaling a specific object.
- Management of the corresponding ui elements.
Each transformation will contain its details per object as defined in scene_structure/model/transforms/transforms.json

### Sensors
Ignore this one for now.

### FE
All front end structure will be placed in js/fe.js. This includes general front end modules:
- Toolbars
- Panels
This will also inlcude utilities for managing existing elements (updating names, icons etc)

### UI
All ui compoments used for the composition of the front end will be placed in js/ui.js. This does NOT include their management, only modules like html element composition:
- General modules (bools, color pickers, buttons etc)
- Annotation-specific controllers (selection/measurement/semantic annotation controllers/modals)
- Toolbox option modules.

### Utils
General utility functions that do not rely on global variables (like rgb2hex, computeRadius) go under js/utils.js.

## Interface & functionallity
### Navigation
Navigation is to stay as is. When a tool is active, holding spacebar pauses tool use and enables navigation using the mouse.
### General UI placement
- The top toolbar will contain general-purpose buttons (settings, info, textailes redirector) and a button for adding models.
- The user toolbar will contain the login/logout and export buttons.
- The left toolbar (previously main toolbar) contains buttons for enabling tools for face selection, semantic annotations and measurements, as well as undo/redo.
- The right toolbar (new) contains an expandable scene structure containing buttons for artefact, selections, semantic annotations, measurements, transforms, sensors and metadata per object.
- Clicking any of these buttons will change to the equivalent toolbar for that attribute.
#### Annotations
Each annotation modality will contain a set of controllers for each of its annotations. These controllers will display the annoation's name and a short indication about its contents. They will also contain buttons for managing the visibility and deleting that annotation, as well as a button which creates a modal for altering some attributes. The modal contains:
- Seaparate fields for changing the name (text input) and description (long text input).
- Separatate fields for adding related rgb images, multispectral images and artefacts. The search/fetch for each is done through the corresponding endpoints.
#### Transforms
From the transformation toolbar, we can apply transformations to the model including translation/rotation and scaling. Selecting it will also visualise a gizmo for applying them.
#### Sensors
Ignore for now
#### Metadata
From the metadata panel, the user can select the desired schema. Retrieval and loading of the schemas is done through the corresponding endpoints. By default, the puc_schema.json is loaded. Loading the schema will display its name, description and version, as well as a button to add attributes to the scene. This will bring up a modal for passing values to these attributes. The modal will be generated dynamically based on the schema itself.
### Tool functionallity
The use of visualization of semantics for measurements, semantic annoatations and selections is to remain similar to the existing, adapted to the current refactoring.

## Coding details
Define and use the existing coding style.

## Misc.
I defined plenty of endpoints for information which might not be available yet, since we are planning a server information. Assume a single url for getting/posting/puting/deleting relevant information. Handle undefined urls appropriately - we will define them much later.

