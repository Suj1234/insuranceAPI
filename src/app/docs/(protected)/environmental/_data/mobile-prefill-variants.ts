import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Mobile to form prefill',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'mobile', in: 'body', required: true, type: 'string', placeholder: '9876543210', description: '10 Digit mobile number', example: '10 Digits' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({ mobile: '1111111111', consent: 'Y', clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.mobileNumber', type: 'string', required: false, description: 'Mobile Number' },
      { field: 'result.pan', type: 'string', required: false, description: 'PAN Number' },
      { field: 'result.panDetails', type: 'object', required: false, description: 'PAN Details' },
      { field: 'result.panDetails.fullName', type: 'string', required: false, description: 'Full name of PAN card holder' },
      { field: 'result.panDetails.splitName', type: 'array', required: false, description: 'Split Name of PAN card holder' },
      { field: 'result.panDetails.address', type: 'object', required: false, description: 'Address as per PAN card' },
      { field: 'result.panDetails.address.line_1', type: 'string', required: false, description: 'Address line 1' },
      { field: 'result.panDetails.address.line_2', type: 'string', required: false, description: 'Address line 2' },
      { field: 'result.panDetails.address.street_name', type: 'string', required: false, description: 'Street Location as on the Address' },
      { field: 'result.panDetails.address.zip', type: 'string', required: false, description: 'Zip code as on the Address' },
      { field: 'result.panDetails.address.city', type: 'string', required: false, description: 'City as on the Address' },
      { field: 'result.panDetails.address.state', type: 'string', required: false, description: 'State as on the Address' },
      { field: 'result.panDetails.address.country', type: 'string', required: false, description: 'Country as on the Address' },
      { field: 'result.panDetails.address.full', type: 'string', required: false, description: 'Complete address as per PAN card' },
      { field: 'result.panDetails.gender', type: 'string', required: false, description: 'Gender as per PAN card' },
      { field: 'result.panDetails.dob', type: 'string', required: false, description: 'Date of Birth as per PAN card' },
      { field: 'result.panDetails.aadhaarLink', type: 'boolean', required: false, description: 'Aadhaar PAN link status (true/false)' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      requestId: 'b5ab0b36-dd17-4b8b-a5a9-982fa3ea92a9',
      result: {
        mobileNumber: '1111111111',
        pan: 'ABCDE1234E',
        panDetails: {
          fullName: 'ABC',
          splitName: ['A', 'B', 'C'],
          address: { line_1: '', line_2: '', street_name: '', zip: '', city: '', state: '', country: '', full: '' },
          gender: 'M',
          dob: '1996-05-10',
          aadhaarLink: true,
        },
      },
      statusCode: 101,
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const MOBILE_PREFILL_VARIANTS: ApiVariant[] = [DEFAULT]
