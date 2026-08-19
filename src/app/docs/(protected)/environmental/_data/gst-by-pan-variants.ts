import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'GST search by PAN',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'pan', in: 'body', required: true, type: 'string', uppercase: true, placeholder: 'AAACR5055K', description: 'PAN to be authenticated', example: 'pattern: ^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({ consent: 'Y', pan: 'AAACR5055K', clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique ID of the API request.' },
      { field: 'result', type: 'array', required: false, description: 'Response object for the given inputs.' },
      { field: 'result[].emailId', type: 'string', required: false, description: 'Email ID of the registered entity linked with the GSTIN' },
      { field: 'result[].applicationStatus', type: 'string', required: false, description: 'Current status of application under GST (MIG = Migrated, DFT = Activated etc)' },
      { field: 'result[].mobNum', type: 'string', required: false, description: 'Mobile Number of the registered entity linked with the GSTIN' },
      { field: 'result[].pan', type: 'string', required: false, description: 'PAN Number of the registered entity' },
      { field: 'result[].gstinRefId', type: 'string', required: false, description: 'Unique GST application reference ID' },
      { field: 'result[].regType', type: 'string', required: false, description: 'Registration Type under GST (V=VAT, S=Service Tax)' },
      { field: 'result[].authStatus', type: 'string', required: false, description: 'GSTIN Status (Active/Inactive)' },
      { field: 'result[].gstinId', type: 'string', required: false, description: 'Unique 15 character GSTIN corresponding to the given tin' },
      { field: 'result[].registrationName', type: 'string', required: false, description: 'Registered Name of the entity as per GST' },
      { field: 'result[].tinNumber', type: 'string', required: false, description: 'Old VAT or Service Tax Tin associated with the GSTIN' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      statusCode: '101',
      requestId: '7ad45acb-dc33-11e8-8063-cba6293b15e6',
      result: [
        { emailId: '', applicationStatus: '', mobNum: '', pan: 'AAACR5055K', gstinRefId: '', regType: '', authStatus: 'Active', gstinId: '09AAACR5055K1Z5', registrationName: '', tinNumber: '' },
        { emailId: '', applicationStatus: '', mobNum: '', pan: 'AAACR5055K', gstinRefId: '', regType: '', authStatus: 'Active', gstinId: '03AAACR5055K2ZG', registrationName: '', tinNumber: '' },
      ],
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const GST_BY_PAN_VARIANTS: ApiVariant[] = [DEFAULT]
