/*===========================================================================

    THOTH
    Sensor Data Fetcher

    Author: Ioannis Giannoukos

===========================================================================*/
let Sensor = {};

/**
 * Fetches the latest sensor reading from the API.
 * @param {string} sensorId - The ID of the sensor to fetch data from.
 * @returns {Promise<Object>} The latest sensor reading, or null if it fails.
*/
Sensor.fetchSensorData = async (sensorId) => {
    const protocol = "https";
    const host = "api.textailes.athenarc.gr";
    const hestia_endpoint = `${protocol}://${host}/sensor-readings?per_page=1&sensor_id=${sensorId}`;

    const apiKey = window.THOTH?.config?.authKey.split("Bearer ")[1].trim();

    try {
        const response = await fetch(hestia_endpoint, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        const is_data_ok = Array.isArray(data) && data.length > 0;
        if (!is_data_ok) return null;

        return data[0];
        // NOTE: `data[0]`:
        //  {
        //    "artifact_id": { "type": "string" },
        //    "atmospheric_pressure": { "type": "number" },
        //    "elevation": { "type": "number" },
        //    "humidity": { "type": "number" },
        //    "luminosity": { "type": "number" }
        //    "sensor_id": { "type": "string" },
        //    "temperature": { "type": "number" },
        //    "timestamp": { "type": "string", "format": "date-time" },
        //    "uv_intensity": { "type": "number" },
        //  }

    } catch (error) {
        console.error("Failed to fetch sensor data:", error);
        return null;
    }
}

export default Sensor;
