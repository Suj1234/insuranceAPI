import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Passport verification',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'fileNo', in: 'body', required: true, type: 'string', description: 'Passport application File Number as printed on the last page of the passport' },
      { name: 'dob', in: 'body', required: true, type: 'string', placeholder: 'DD/MM/YYYY', description: 'Date of birth as per Passport' },
      { name: 'passportNo', in: 'body', required: false, type: 'string', uppercase: true, description: 'Passport Number', example: '^(?!^0+$)[a-zA-Z0-9]{3,20}$' },
      { name: 'doi', in: 'body', required: false, type: 'string', placeholder: 'DD/MM/YYYY', description: 'Date of Issue as per Passport' },
      { name: 'name', in: 'body', required: false, type: 'string', description: 'Complete name of the passport holder' },
      { name: 'passportStatus', in: 'body', required: false, type: 'string', enum: ['Y', 'N'], description: 'If status of passport required' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({
      consent: 'Y',
      fileNo: 'BO3072344560818',
      dob: '17/08/1987',
      passportNo: 'S3733862',
      doi: '14/05/2018',
      name: 'OMKAR MILIND SHIRHATTI',
      passportStatus: 'Y',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.passportNumber', type: 'object', required: false, description: 'Object containing the passport number as per source' },
      { field: 'result.passportNumber.passportNumberFromSource', type: 'string', required: false, description: 'Passport number allocated for the given File Number and Date of birth' },
      { field: 'result.passportNumber.passportNumberMatch', type: 'boolean', required: false, description: 'Whether given passport number matches the number as per source' },
      { field: 'result.applicationDate', type: 'string', required: false, description: 'Date of application as per source' },
      { field: 'result.typeOfApplication', type: 'string', required: false, description: 'Application type [Normal or Tatkaal]' },
      { field: 'result.dateOfIssue', type: 'object', required: false, description: 'Object containing the dispatch date as per source' },
      { field: 'result.dateOfIssue.dispatchedOnFromSource', type: 'string', required: false, description: 'Date of Dispatch or Date of Counter Delivery of passport as per source' },
      { field: 'result.dateOfIssue.dateOfIssueMatch', type: 'boolean', required: false, description: 'Whether the date of Issue is within 2 days of date of dispatch' },
      { field: 'result.name', type: 'object', required: false, description: 'Object containing the details of the passport holder name as per source' },
      { field: 'result.name.nameScore', type: 'float', required: false, description: 'Name match score' },
      { field: 'result.name.nameMatch', type: 'boolean', required: false, description: 'Whether the given name matches with the name as per source' },
      { field: 'result.name.surnameFromPassport', type: 'string', required: false, description: 'Surname as per Source' },
      { field: 'result.name.nameFromPassport', type: 'string', required: false, description: 'Given Name [First and Middle] as per source' },
      { field: 'result.status', type: 'string', required: false, description: 'Status message as per source' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      result: {
        passportNumber: { passportNumberFromSource: 'S3733862', passportNumberMatch: true },
        applicationDate: '14/05/2018',
        typeOfApplication: 'Tatkaal',
        dateOfIssue: { dispatchedOnFromSource: '14/05/2018', dateOfIssueMatch: true },
        name: { nameScore: 1, nameMatch: true, surnameFromPassport: 'SHIRHATTI', nameFromPassport: 'OMKAR MILIND' },
        status: 'Passport S3733862 has been dispatched on 14/05/2018 via Speed Post Tracking Number',
      },
      requestId: 'f3de6c55-6c0f-11e9-bf8e-610d4b51e956',
      statusCode: 101,
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const PASSPORT_VARIANTS: ApiVariant[] = [DEFAULT]
