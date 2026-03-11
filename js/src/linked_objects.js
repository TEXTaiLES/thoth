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

    LinkedObjects.linkedObjectsMap.set("child_objects", linked_objects.child_objects);
}

LinkedObjects.setupLinkedObjectsList = () => {
    const elLinkedObjects = ATON.UI.createContainer();

    const renderList = () => {
        elLinkedObjects.replaceChildren();

        const linkedObjectsList = LinkedObjects.linkedObjectsMap?.get("child_objects");

        if (!linkedObjectsList || !Array.isArray(linkedObjectsList)) {
            console.warn("Child objects are not loaded yet or empty.");
            return;
        }

        ATON.checkAuth(
            (u) => {
                // On logged-in user case
                for (const child_object of linkedObjectsList) {
                    elLinkedObjects.append(ATON.UI.createButton({
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

    return elLinkedObjects;
}

export default LinkedObjects;
