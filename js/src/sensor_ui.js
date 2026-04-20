/*===========================================================================

    THOTH
    Sensor Data Display - UI modules

    Author: Ioannis Giannoukos

===========================================================================*/
import Sensor from './sensor.js';


let UI = {};


UI.createSensorDashboard = (sensorId) => {
    const elContainer = ATON.UI.createContainer({
        classes: "bg-body-secondary rounded-2 px-3 py-2 mb-2 border"
    });

    const elHeader = ATON.UI.createContainer({ classes: "fw-bold border-bottom mb-2 pb-1" });
    elHeader.textContent = "Environmental Conditions";

    const atmosphericPressureClass = "sensor-atmospheric_pressure";
    const elevationClass = "sensor-elevation";
    const humidityClass = "sensor-humidity";
    const luminosityClass = "sensor-luminosity";
    const temperatureClass = "sensor-temperature";
    const uvIntensityClass = "sensor-uv_intensity";
    const timeClass = "sensor-time";

    const createDataRow = (label, spanClass, defaultText, unit) => {
        const elRow = ATON.UI.createContainer({ classes: "mb-1" });
        elRow.style.fontSize = "0.9rem";
        elRow.innerHTML = `<strong>${label}:</strong> <span class="${spanClass}">${defaultText}</span> ${unit}`;
        return elRow;
    }

    const elSensorId = createDataRow("Sensor ID", "sensor-id", sensorId, "");
    const elAtmosphericPressure = createDataRow("Atmospheric Pressure", atmosphericPressureClass, "NaN", "mbar");
    const elElevation = createDataRow("Elevation", elevationClass, "NaN", "m");
    const elHumidity = createDataRow("Humidity", humidityClass, "NaN", "%");
    const elLuminosity = createDataRow("Luminosity", luminosityClass, "help", "%");
    const elTemperature = createDataRow("Temperature", temperatureClass, "NaN", "Celsius");
    const elUVIntensity = createDataRow("UV Intensity", uvIntensityClass, "NaN", "%");

    const elTime = ATON.UI.createContainer({ classes: "text-muted mt-2" });
    elTime.style.fontSize = "0.75rem";
    elTime.innerHTML = `Reading Time: <span class="sensor-time">Loading...</span>`;

    elContainer.append(elHeader, elSensorId, elAtmosphericPressure, elElevation, elHumidity, elLuminosity, elTemperature, elUVIntensity, elTime);

    const atmosphericPressureSpan = elAtmosphericPressure.querySelector(`.${atmosphericPressureClass}`);
    const elevationSpan = elElevation.querySelector(`.${elevationClass}`);
    const humiditySpan = elHumidity.querySelector(`.${humidityClass}`);
    const luminositySpan = elLuminosity.querySelector(`.${luminosityClass}`);
    const temperatureSpan = elTemperature.querySelector(`.${temperatureClass}`);
    const uvIntensitySpan = elUVIntensity.querySelector(`.${uvIntensityClass}`);
    const timeSpan = elTime.querySelector(`.${timeClass}`);

    const clearDashboard = () => {
        atmosphericPressureSpan.textContent = "";
        elevationSpan.textContent = "";
        humiditySpan.textContent = "";
        luminositySpan.textContent = "";
        temperatureSpan.textContent = "";
        uvIntensitySpan.textContent = "";
        timeSpan.textContent = "";
    };

    const updateDashboard = async () => {
        if (!sensorId) {
            clearDashboard();
            return;
        }

        const data = await Sensor.fetchSensorData(sensorId);
        if (!data) {
            clearDashboard();
            return;
        }

        atmosphericPressureSpan.textContent = data.atmospheric_pressure ?? "";
        elevationSpan.textContent = data.elevation ?? "";
        humiditySpan.textContent = data.humidity ?? "";
        luminositySpan.textContent = data.luminosity ?? "";
        temperatureSpan.textContent = data.temperature ?? "";
        uvIntensitySpan.textContent = data.uv_intensity ?? "";
        timeSpan.textContent = data.timestamp ? new Date(data.timestamp).toLocaleString() : "";
    };

    updateDashboard();

    const intervalId = setInterval(updateDashboard, 15*60*1000);
    elContainer._sensorInterval = intervalId;

    return elContainer;
}


export default UI;
