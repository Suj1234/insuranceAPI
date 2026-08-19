import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Udyog Aadhaar authentication',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'uan', in: 'body', required: true, type: 'string', uppercase: true, placeholder: 'GJ20A0007692', description: '12 character Udyog Aadhaar Number to be authenticated', example: 'minLength: 12 maxLength: 12 pattern: ^[A-Z]{2}\\d{2}[A-Z]{1}\\d{7}$' },
      { name: 'mobile', in: 'body', required: false, type: 'string', placeholder: '9876543210', description: 'Mobile Number registered against the UAN', example: 'pattern: ^[6-9]{1}[0-9]{9}$, length: 10 digits' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({ consent: 'Y', uan: 'GJ20A0007692', mobile: '', clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'status-code', type: 'string', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'request_id', type: 'string', required: true, description: 'Unique ID of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.pin', type: 'string', required: false, description: 'Pin Code of the place of registration' },
      { field: 'result.DateOFCommencement', type: 'string', required: false, description: 'Date of commencement of business of the entity' },
      { field: 'result.appliedDate', type: 'string', required: false, description: 'Date of application as per source' },
      { field: 'result.modifiedDate', type: 'string', required: false, description: 'Date of modification as per source' },
      { field: 'result.addedOn', type: 'string', required: false, description: 'Date of addition of National Industry Classification code as per source' },
      { field: 'result.aadhar', type: 'string', required: false, description: 'Aadhaar number of the owner of the entity' },
      { field: 'result.district', type: 'string', required: false, description: 'District of the place of registration of the entity' },
      { field: 'result.DistrictIndustryCentre', type: 'string', required: false, description: 'District Industry Center corresponding to the place of registration of the entity' },
      { field: 'result.NameofEnterPrise', type: 'string', required: false, description: 'Registered name of the entity' },
      { field: 'result.NumberofEmp', type: 'string', required: false, description: 'No. of employees declared by the entity' },
      { field: 'result.state', type: 'string', required: false, description: 'State of registration of the entity' },
      { field: 'result.OwnerName', type: 'string', required: false, description: 'Registered name of the Owner' },
      { field: 'result.MajorActivity', type: 'string', required: false, description: 'Registered nature of business / activity of the entity' },
      { field: 'result.email', type: 'string', required: false, description: 'Registered email id of the entity' },
      { field: 'result.pan', type: 'string', required: false, description: 'Registered PAN of the Entity' },
      { field: 'result.ifsc', type: 'string', required: false, description: 'IFSC Code of the registered Bank Account of the Entity' },
      { field: 'result.mobile', type: 'string', required: false, description: 'Registered mobile number of the entity' },
      { field: 'result.address', type: 'string', required: false, description: 'Registered Address of the entity' },
      { field: 'result.social_category', type: 'string', required: false, description: 'Registered Social Category of the entity, GENERAL, SC, ST, OBC etc' },
      { field: 'result.AccountNumber', type: 'string', required: false, description: 'Registered Bank account number of the entity' },
      { field: 'result.EntType', type: 'string', required: false, description: 'Size of the organization, Micro, Small, Medium' },
      { field: 'result.gender', type: 'string', required: false, description: 'Gender of the owner' },
      { field: 'result.type_of_org', type: 'string', required: false, description: 'Registered constitution of the entity' },
      { field: 'result.Investment', type: 'string', required: false, description: 'Declared amount of investment of the owners in the business' },
      { field: 'result.NIC_Digit_Code', type: 'string', required: false, description: 'NIC Activity Code of business of the entity' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      request_id: '9641111f-2cc5-410f-9696-fa860dd4ceac',
      result: {
        AccountNumber: '', DateOFCommencement: '21/11/1995', DistrictIndustryCentre: 'RAJKOT',
        EntType: 'A - Micro', Investment: '', NIC_Digit_Code: 'XXXX-Manufacture of other electrical equipment',
        NameofEnterPrise: 'XXX XXXX', NumberofEmp: '', OwnerName: '', aadhar: '', addedOn: '02/05/2016',
        address: '', appliedDate: '02/05/2016', district: '', email: '', gender: '', ifsc: '', mobile: '',
        modifiedDate: 'N/A', pan: '', pin: '', social_category: 'General', state: 'GUJARAT', type_of_org: '',
      },
      'status-code': '101',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const UDYOG_AADHAAR_VARIANTS: ApiVariant[] = [DEFAULT]
