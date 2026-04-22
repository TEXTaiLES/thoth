/*===========================================================================

    THOTH
    Linked Objects

    Author: Ioannis Giannoukos

===========================================================================*/
let LinkedObjects = {};

LinkedObjects.setup = () => {
    LinkedObjects.linkedObjectsMap = new Map();
}

LinkedObjects.parseLinkedObjects = (linked_objects) => {
    if (!linked_objects) return;

    const parent_object = linked_objects.parent_object;
    const is_parent_object_set = parent_object && typeof(parent_object) === "object" && Object.keys(parent_object).length > 0;
    if (is_parent_object_set) LinkedObjects.linkedObjectsMap.set("parent_object", parent_object);

    const child_objects = linked_objects.child_objects;
    const is_child_objects_set = Array.isArray(child_objects) && child_objects.length > 0;
    if (is_child_objects_set) LinkedObjects.linkedObjectsMap.set("child_objects", child_objects);
}

LinkedObjects.setupLinkedObjectsLists = () => {
    const elLinkedParentObject = ATON.UI.createContainer();
    const elLinkedChildObjects = ATON.UI.createContainer();

    const renderList = () => {
        elLinkedParentObject.replaceChildren();
        elLinkedChildObjects.replaceChildren();

        const linkedParentObject = LinkedObjects.linkedObjectsMap?.get("parent_object");
        if (!linkedParentObject) console.log("Parent object is not loaded yet or empty.");

        const linkedChildObjectsList = LinkedObjects.linkedObjectsMap?.get("child_objects");
        const isLinkedChildObjectsListOK = linkedChildObjectsList && Array.isArray(linkedChildObjectsList);
        if (!isLinkedChildObjectsListOK) console.log("Child objects are not loaded yet or empty.");

        if (!linkedParentObject && !isLinkedChildObjectsListOK) return;

        ATON.checkAuth(
            (u) => {
                // On logged-in user case
                if (linkedParentObject?.scene_id) {
                    elLinkedParentObject.append(ATON.UI.createButton({
                        text: linkedParentObject.name ?? "Parent Object",
                        onpress: () => window.open(`?s=${u.username}/${linkedParentObject.scene_id}`, "_blank"),
                        tooltip: "Open scene in new tab",
                    }));
                }
                let children_counter = 1;
                for (const child_object of linkedChildObjectsList) {
                    if (!child_object?.scene_id) continue;
                    elLinkedChildObjects.append(ATON.UI.createButton({
                        text: child_object.name ?? `Child Object ${children_counter++}`,
                        onpress: () => window.open(`?s=${u.username}/${child_object.scene_id}`, "_blank"),
                        tooltip: "Open scene in new tab",
                    }));
                }
            },
            () => {
                console.warn("User is not logged in.");
                return;
            }
        );
    };

    ATON.on("SceneJSONLoaded", renderList);

    renderList();

    return [ elLinkedParentObject, elLinkedChildObjects ];
}

export default LinkedObjects;
