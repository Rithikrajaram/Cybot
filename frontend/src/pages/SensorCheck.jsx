import React, { useState, useEffect } from 'react';
import { Activity, XCircle, CheckCircle } from 'lucide-react';

const SensorCheck = () => {
    const [sensors, setSensors] = useState({});
    const [permissions, setPermissions] = useState({});
    const [data, setData] = useState({});

    const SENSOR_LIST = [
        'Magnetometer',
        'Accelerometer',
        'Gyroscope',
        'AbsoluteOrientationSensor',
        'RelativeOrientationSensor',
        'AmbientLightSensor'
    ];

    useEffect(() => {
        const checkSensors = async () => {
            const results = {};
            const permResults = {};

            for (const sensorName of SENSOR_LIST) {
                if (sensorName in window) {
                    results[sensorName] = 'Supported API';
                    try {
                        // Check Permissions
                        const sensorType = sensorName === 'Magnetometer' ? 'magnetometer' :
                            sensorName === 'Accelerometer' ? 'accelerometer' :
                                sensorName === 'Gyroscope' ? 'gyroscope' : 'accelerometer'; // fallback

                        const perm = await navigator.permissions.query({ name: sensorType });
                        permResults[sensorName] = perm.state;

                        // Try to init
                        try {
                            const sensor = new window[sensorName]({ frequency: 1 });
                            sensor.addEventListener('reading', () => {
                                setData(prev => ({
                                    ...prev,
                                    [sensorName]: {
                                        x: sensor.x?.toFixed(2),
                                        y: sensor.y?.toFixed(2),
                                        z: sensor.z?.toFixed(2),
                                        val: sensor.illuminance || sensor.quaternion
                                    }
                                }));
                            });
                            sensor.addEventListener('error', (e) => {
                                results[sensorName] = `Error: ${e.error.name} - ${e.error.message}`;
                            });
                            sensor.start();
                            results[sensorName] = 'Active & Reading';
                        } catch (e) {
                            results[sensorName] = `Init Failed: ${e.message}`;
                        }

                    } catch (e) {
                        permResults[sensorName] = 'Permission Query Failed';
                    }
                } else {
                    results[sensorName] = 'Not Supported in Browser';
                }
            }
            setSensors(results);
            setPermissions(permResults);
        };

        checkSensors();
    }, []);

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Activity className="text-blue-500" /> Sensor Diagnostics
            </h1>

            <div className="grid gap-4">
                {SENSOR_LIST.map(sensor => (
                    <div key={sensor} className="bg-gray-900 border border-gray-800 p-4 rounded-lg flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg">{sensor}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${sensors[sensor]?.includes('Active') ? 'bg-green-900 text-green-300' :
                                    sensors[sensor]?.includes('Error') ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-500'
                                }`}>
                                {sensors[sensor] || 'Checking...'}
                            </span>
                        </div>

                        <div className="text-sm text-gray-400">
                            Permission: <span className="text-white">{permissions[sensor] || 'Unknown'}</span>
                        </div>

                        {data[sensor] && (
                            <div className="mt-2 p-2 bg-black/50 rounded font-mono text-xs text-green-400">
                                {JSON.stringify(data[sensor], null, 2)}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-8 p-4 bg-gray-800 rounded-lg text-sm text-gray-300">
                <h3 className="font-bold text-white mb-2">Troubleshooting</h3>
                <ol className="list-decimal pl-5 space-y-1">
                    <li>Open <code>chrome://flags</code> in a new tab.</li>
                    <li>Search for <strong>"Generic Sensor"</strong>.</li>
                    <li>Enable <strong>"Generic Sensor Extra Classes"</strong>.</li>
                    <li>Restart Chrome.</li>
                </ol>
            </div>
        </div>
    );
};

export default SensorCheck;
