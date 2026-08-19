import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'PAN DOB status',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'pan', in: 'body', required: true, type: 'string', uppercase: true, placeholder: 'ABCDE1234F', description: 'PAN Number to be authenticated', example: 'minLength: 10 maxLength: 10 pattern: ^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({ pan: 'ABCDE1234E', consent: 'Y', clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.status', type: 'string', required: false, description: 'PAN Status (Active/Inactive)' },
      { field: 'result.name', type: 'string', required: false, description: 'Complete Name of PAN holder' },
      { field: 'result.dob', type: 'string', required: false, description: 'Date of Birth/Incorporation of PAN holder' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({ requestId: '8c506938-9f57-4490-aa08-fc3659c06d79', result: { status: 'Active', name: 'abc', dob: '1992-04-06' }, statusCode: 101, clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const PAN_DOB_STATUS_VARIANTS: ApiVariant[] = [DEFAULT]
