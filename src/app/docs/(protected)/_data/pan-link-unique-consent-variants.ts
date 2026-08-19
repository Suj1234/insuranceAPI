import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Share consent',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'lat', in: 'body', required: false, type: 'string', description: 'Latitude details of the user sharing consent', example: 'Must be valid coordinates' },
      { name: 'long', in: 'body', required: false, type: 'string', description: 'Longitude details of the user sharing consent', example: 'Must be valid coordinates' },
      { name: 'ipAddress', in: 'body', required: false, type: 'string', description: 'IP address of the user sharing consent', example: '"A.B.C.D", where the value of A, B, C, and D may range from 0 to 255' },
      { name: 'userAgent', in: 'body', required: true, type: 'string', description: 'A string that lets servers and network peers identify the application, operating system, vendor, and/or version of the requesting user agent', example: 'Max-length 256' },
      { name: 'deviceId', in: 'body', required: false, type: 'string', description: 'User Device ID details', example: 'Max-length 200' },
      { name: 'deviceInfo', in: 'body', required: false, type: 'string', description: 'User Device Information', example: 'Max-length 200' },
      { name: 'name', in: 'body', required: true, type: 'string', description: 'Name of the user sharing consent' },
      { name: 'consentTime', in: 'body', required: true, type: 'string', description: 'Current Unix/Epoch Timestamp', example: 'Must be valid epoch time not before 5 minutes from now' },
      { name: 'consentText', in: 'body', required: true, type: 'string', description: 'Consent body accepted by the user', example: 'Max-length 10000' },
      { name: 'clientData', in: 'body', required: true, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: true, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({
      lat: '19',
      long: '82',
      ipAddress: '12.12.12.12',
      userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0',
      deviceId: 'xxxx',
      deviceInfo: '1234',
      consent: 'Y',
      name: 'Rahul Kumar',
      consentTime: '1612442987',
      consentText: 'Customer consent body to be shared here',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.accessKey', type: 'string', required: false, description: 'Access Key to invoke the next set of API/s' },
      { field: 'result.accessKeyValidity', type: 'string', required: false, description: 'Validity of the unique access key in Unix/Epoch Timestamp format (valid for 30 minutes from shared consent timestamp)' },
      { field: 'result.message', type: 'string', required: false, description: 'Message to display the status of consent capture' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent (passed as is)' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      result: {
        accessKey: '2cc1610c-3f25-4695-9d7c-4e391758898c',
        accessKeyValidity: '1612446446',
        message: 'Consent Accepted',
      },
      statusCode: 101,
      requestId: '2cc1610c-3f25-4695-9d7c-4e391758898c',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const PAN_LINK_UNIQUE_CONSENT_VARIANTS: ApiVariant[] = [DEFAULT]
