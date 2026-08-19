import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'PAN Aadhaar link status',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'pan', in: 'body', required: true, type: 'string', uppercase: true, placeholder: 'ABCDE1234F', description: 'PAN number of the user', example: 'minLength: 10, maxLength: 10, pattern: ^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$' },
      { name: 'aadhaarNo', in: 'body', required: true, type: 'string', placeholder: '123456789012', description: '12 digit Aadhaar Number of the user', example: 'minLength: 12, maxLength: 12, pattern: ^[0-9]{12}$' },
      { name: 'accessKey', in: 'body', required: true, type: 'string', description: 'Access Key to invoke the next set of API/s (from the Share Consent step)' },
      { name: 'clientData', in: 'body', required: true, type: 'object', description: 'Data of the user sharing consent (passed as is)' },
      { name: 'clientData.caseId', in: 'body', required: true, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({
      pan: 'BXXXXXXXXR',
      aadhaarNo: 'xxxxxxxx6917',
      consent: 'Y',
      accessKey: '5d08f3a0-3a5c-43e4-a4af-1d496bd18cdc',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.message', type: 'string', required: false, description: 'Message that describes whether PAN is linked to Aadhaar Number' },
      { field: 'result.linked', type: 'boolean', required: false, description: 'Status whether PAN is linked or not (True/False)' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent (passed as is)' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      requestId: '5c42f558-e193-4ffc-baaf-591383ccbac7',
      result: {
        message: 'Your PAN is linked to Aadhaar Number XXXX XXXX 6917',
        linked: true,
      },
      statusCode: 101,
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const PAN_LINK_UNIQUE_CHECK_VARIANTS: ApiVariant[] = [DEFAULT]
