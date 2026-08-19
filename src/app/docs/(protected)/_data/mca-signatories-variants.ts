import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'MCA signatories',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'cin', in: 'body', required: true, type: 'string', uppercase: true, placeholder: 'AAA-1234', description: '15 character Company Identification Number or 8 character LLPIN issued by the Ministry of Corporate Affairs (MCA)', example: 'minLength: 21 maxLength: 21' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({ consent: 'Y', cin: 'AAA-1234', clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'status-code', type: 'string', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'request_id', type: 'string', required: true, description: 'Unique ID of the API request.' },
      { field: 'result', type: 'array', required: false, description: 'List of directors/partners.' },
      { field: 'result[].date_of_appointment', type: 'string', required: false, description: 'Date of Appointment of director/partner' },
      { field: 'result[].designation', type: 'string', required: false, description: 'Designation of director/partner' },
      { field: 'result[].dsc_expiry_date', type: 'string', required: false, description: 'Expiry date of Digital Signature Certificate of director/partner' },
      { field: 'result[].address', type: 'string', required: false, description: 'Address of director/partner' },
      { field: 'result[].DIN/DPIN/PAN', type: 'string', required: false, description: 'DIN/DPIN/PAN of director/partner' },
      { field: 'result[].full_name', type: 'string', required: false, description: 'Full Name of director/partner' },
      { field: 'result[].wheather_dsc_registered', type: 'string', required: false, description: 'Whether DSC registered' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      'status-code': '101',
      request_id: '8e236fe9-d8fa-11e7-8bbb-5f3dd11329a1',
      result: [
        {
          date_of_appointment: '28/04/2010',
          designation: 'Designated Partner',
          dsc_expiry_date: '05/10/2019',
          address: 'NIRMAL ANAND CO OP HSG SOC. FLAT NO. 5 A-WING 2ND FLOOR J.P.ROAD ANDHERI WEST MUMBAI 400058',
          'DIN/DPIN/PAN': '05005591',
          full_name: 'GADA JITENDRA RAGHAVJI',
          wheather_dsc_registered: 'Yes',
        },
        {
          date_of_appointment: '28/04/2010',
          designation: 'Designated Partner',
          dsc_expiry_date: '05/10/2019',
          address: 'VEERA DESAI ROAD ADARSH NAGAR 28/445 ANDHERI WEST MUMBAI 400055',
          'DIN/DPIN/PAN': '05005933',
          full_name: 'GADA RAMESHCHANDRA RAGHAVJI',
          wheather_dsc_registered: 'Yes',
        },
      ],
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const MCA_SIGNATORIES_VARIANTS: ApiVariant[] = [DEFAULT]
