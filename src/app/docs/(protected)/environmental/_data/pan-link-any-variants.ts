import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'PAN link status',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'pan', in: 'body', required: true, type: 'string', uppercase: true, placeholder: 'ABCDE1234F', description: 'PAN Number to be verified', example: 'minLength: 10 maxLength: 10 pattern: /^[A-Z]{3}[P][A-Z][0-9]{4}[ABCDEFGHJKLMNPQR]$/i' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({ pan: 'AXXXXXXXXA', consent: 'Y', clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.isAadhaarLinked', type: 'boolean', required: false, description: 'Status whether PAN is linked or not (True/False)' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      requestId: '4cd50347-a0a7-441e-984c-b2d2c2908110',
      statusCode: 101,
      result: { isAadhaarLinked: true },
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const PAN_LINK_ANY_VARIANTS: ApiVariant[] = [DEFAULT]
