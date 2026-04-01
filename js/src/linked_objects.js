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

    LinkedObjects.linkedObjectsMap.set("parent_object", linked_objects.parent_object);
    LinkedObjects.linkedObjectsMap.set("child_objects", linked_objects.child_objects);
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
                if (linkedParentObject) {
                    elLinkedParentObject.append(ATON.UI.createButton({
                        text: linkedParentObject.name ?? "Object 0",
                        onpress: () => window.open(`?s=${u.username}/${linkedParentObject.scene_id}`, "_blank"),
                        tooltip: "Open scene in new tab",
                    }));
                }
                for (const child_object of linkedChildObjectsList) {
                    elLinkedChildObjects.append(ATON.UI.createButton({
                        text: child_object.name ?? "Child Object",
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
