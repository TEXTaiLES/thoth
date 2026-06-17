# API update
I want to make THOTH's logic for some endpoints more modular with external services.
Read thoth/api_details.json and thoth/config.json. I want to apply the following logic to this set of endpoints:
1) If endpoints are enabled and the specific endpoint is enabled, use the specified endpoint according with their type, functionality and other information.
2) If endpoints are disabled or the the specific endpoint is disabled, fallback to ATON's internal API/other specified behaviour.

- Ask questions dynamically for anything unclear.
- Ignore the annotation avro schema field
- Ignore the authentication endpoint logic for now - keep auth function as is.
- For any feautre which requre authentication, keep the authentication logic.regardless of endpoint usage regardless of what is specified in the config json.
- Keep existing logic for errors and warnings unless specified otherwise in fallback.
- For the scene PUT request also implement the export feature for the internal fallback (currently only a placeholder). Read ATON's api v2 for the export logic.
- NEVER work on ATON's source code directly, only modify THOTH's code.