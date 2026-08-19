// PAN Status Check — copied verbatim from the TotalKYC vendor docs
// (External API/PAN Status.pdf). Single request/response scenario.

import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'PAN status',
  request: {
    params: [
      { name: 'consent',           in: 'body', required: true,  type: 'string', description: 'Consent is required to make the API request.', enum: ['Y', 'N'] },
      { name: 'pan',               in: 'body', required: true,  type: 'string', label: 'PAN Number', uppercase: true, placeholder: 'ABCDE1234F', description: 'PAN Number to be authenticated', example: 'minLength: 10 maxLength: 10 pattern: ^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$' },
      { name: 'name',              in: 'body', required: true,  type: 'string', description: 'Exact name as per PAN' },
      { name: 'dob',               in: 'body', required: true,  type: 'string', label: 'Date of Birth', placeholder: 'DD/MM/YYYY', description: 'Date of birth as per PAN', example: '^\\d{1,2}/\\d{1,2}/\\d{4}$' },
      { name: 'clientData',        in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({
      pan: 'BXXXXXXXXR',
      name: 'Omkar Milind Shirhatti',
      dob: '17/08/1987',
      consent: 'Y',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'status-code',         type: 'string',  required: true,  description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'request_id',          type: 'string',  required: true,  description: 'Unique id of the API request.' },
      { field: 'result',              type: 'object',  required: true,  description: 'Response object for the given inputs.' },
      { field: 'result.status',       type: 'string',  required: false, description: 'Status of the PAN. [Active or Inactive]' },
      { field: 'result.duplicate',    type: 'boolean', required: false, description: 'Whether the PAN has been tagged as duplicate by Income Tax Department (Please Note - This detail is no longer supported now)' },
      { field: 'result.nameMatch',    type: 'boolean', required: false, description: 'Whether the given name matches with the ITD Records' },
      { field: 'result.dobMatch',     type: 'boolean', required: false, description: 'Whether the given date of birth matches with the ITD Records' },
      { field: 'clientData',          type: 'object',  required: true,  description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId',   type: 'string',  required: true,  description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      result: {
        status: 'Active',
        duplicate: null,
        nameMatch: true,
        dobMatch: true,
      },
      request_id: 'deff5ed8-0460-11e9-a082-4742912ca12a',
      'status-code': '101',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const PAN_STATUS_VARIANTS: ApiVariant[] = [DEFAULT]
