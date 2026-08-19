import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const REQUEST_PARAMS = [
  { name: 'consent', in: 'body' as const, required: true, type: 'string' as const, enum: ['Y', 'N'], description: 'Consent is required to make the API request' },
  { name: 'pan', in: 'body' as const, required: true, type: 'string' as const, uppercase: true, placeholder: 'AAECP3450G', description: 'PAN to be authenticated', example: 'pattern: ^[A-Za-z]{5}\\d{4}[A-Za-z]{1}$' },
  { name: 'liabilityDetails', in: 'body' as const, required: false, type: 'boolean' as const, description: 'Optional parameter to fetch percentage liabilities paid via GSTR-3B' },
  { name: 'stateCode', in: 'body' as const, required: false, type: 'array' as const, description: "List of State Codes for which GSTIN's have to be fetched", example: 'pattern: ^\\d{2}$ per item' },
  { name: 'clientData', in: 'body' as const, required: false, type: 'object' as const, description: 'Data of the user sharing consent' },
  { name: 'clientData.caseId', in: 'body' as const, required: false, type: 'string' as const, description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
]

// Shared field tree for one GSTIN entry in result[]. `prefix` lets the same
// list be reused under `result[].` for both the docs variant and the Tryout
// responseFields (which additionally need a `data.` prefix).
function gstinEntryFields(prefix: string) {
  return [
    { field: `${prefix}authStatus`, type: 'string', required: false, description: 'GSTIN Status (Active/Inactive)' },
    { field: `${prefix}applicationStatus`, type: 'string', required: false, description: 'Current status of application under GST (MIG = Migrated, DFT = Activated etc)' },
    { field: `${prefix}emailId`, type: 'string', required: false, description: 'Email ID of the registered entity linked with the GSTIN' },
    { field: `${prefix}gstinId`, type: 'string', required: false, description: 'Unique 15 character GSTIN corresponding to the given tin' },
    { field: `${prefix}gstinRefId`, type: 'string', required: false, description: 'Unique GST application reference ID' },
    { field: `${prefix}mobNum`, type: 'string', required: false, description: 'Mobile Number of the registered entity linked with the GSTIN' },
    { field: `${prefix}pan`, type: 'string', required: false, description: 'PAN Number of the registered entity' },
    { field: `${prefix}regType`, type: 'string', required: false, description: 'Registration Type under GST (V=VAT, S=Service Tax)' },
    { field: `${prefix}registrationName`, type: 'string', required: false, description: 'Registered Name of the entity as per GST' },
    { field: `${prefix}tinNumber`, type: 'string', required: false, description: 'Old VAT or Service Tax Tin associated with the GSTIN' },
    { field: `${prefix}profile`, type: 'object', required: false, description: 'Entity Profile' },
    { field: `${prefix}profile.stjCd`, type: 'string', required: false, description: 'State Jurisdiction Code' },
    { field: `${prefix}profile.lgnm`, type: 'string', required: false, description: 'Legal Name of the Business or Individual corresponding to the GSTIN' },
    { field: `${prefix}profile.stj`, type: 'string', required: false, description: 'State Jurisdiction' },
    { field: `${prefix}profile.dty`, type: 'string', required: false, description: 'Taxpayer Type' },
    { field: `${prefix}profile.adadr`, type: 'array', required: false, description: 'Address information for additional places of business' },
    { field: `${prefix}profile.cxdt`, type: 'string', required: false, description: 'Date of Cancellation of Registration' },
    { field: `${prefix}profile.gstin`, type: 'string', required: false, description: 'Given GSTIN' },
    { field: `${prefix}profile.nba`, type: 'array', required: false, description: 'Nature of business registered under GST' },
    { field: `${prefix}profile.lstupdt`, type: 'string', required: false, description: 'Last Updated' },
    { field: `${prefix}profile.rgdt`, type: 'string', required: false, description: 'Registration date under GST' },
    { field: `${prefix}profile.ctb`, type: 'string', required: false, description: 'Constitution of Business' },
    { field: `${prefix}profile.pradr`, type: 'object', required: false, description: 'Primary business contact information' },
    { field: `${prefix}profile.tradeNam`, type: 'string', required: false, description: 'Trade Name' },
    { field: `${prefix}profile.sts`, type: 'string', required: false, description: 'Current status of registration under GST' },
    { field: `${prefix}profile.ctjCd`, type: 'string', required: false, description: 'Central Jurisdiction Code' },
    { field: `${prefix}profile.ctj`, type: 'string', required: false, description: 'Central Jurisdiction' },
    { field: `${prefix}profile.mbr`, type: 'array', required: false, description: 'Member names if provided by GSP' },
    { field: `${prefix}profile.canFlag`, type: 'string', required: false, description: 'Flag to identify if an application for cancellation of GST has been filed' },
    { field: `${prefix}profile.cmpRt`, type: 'string', required: false, description: 'Compliance rating if provided by GSP' },
    { field: `${prefix}profile.contacted`, type: 'object', required: false, description: 'Contact Information' },
    { field: `${prefix}profile.contacted.email`, type: 'string', required: false, description: 'Email ID' },
    { field: `${prefix}profile.contacted.mobNum`, type: 'string', required: false, description: 'Mobile number' },
    { field: `${prefix}profile.contacted.name`, type: 'string', required: false, description: 'Name' },
    { field: `${prefix}profile.ppr`, type: 'string', required: false, description: 'NA' },
    { field: `${prefix}filingStatus`, type: 'object', required: false, description: 'Filing Status' },
    { field: `${prefix}filingStatus.gstin`, type: 'string', required: false, description: 'Fifteen character unique GSTIN' },
    { field: `${prefix}filingStatus.complianceStatus`, type: 'object', required: false, description: 'Compliance Status' },
    { field: `${prefix}filingStatus.complianceStatus.isAnyDelay`, type: 'boolean', required: false, description: 'Delay in GST returns filing' },
    { field: `${prefix}filingStatus.complianceStatus.isDefaulter`, type: 'boolean', required: false, description: 'Default in GST returns filing' },
    { field: `${prefix}filingStatus.result`, type: 'array', required: false, description: 'Response object for the given inputs — one entry per financial year' },
    { field: `${prefix}filingStatus.result[].eFiledlist`, type: 'array', required: false, description: 'Filing Description' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].mof`, type: 'string', required: false, description: 'Mode of Filing' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].dof`, type: 'string', required: false, description: 'Date of Filing' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].retPrd`, type: 'string', required: false, description: 'Return Period' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].rtntype`, type: 'string', required: false, description: 'Return Type' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].arn`, type: 'string', required: false, description: 'Application Reference Number' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].status`, type: 'string', required: false, description: 'Filing Status' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].dueDt`, type: 'string', required: false, description: 'Due Date of filing Return' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].isDelay`, type: 'boolean', required: false, description: 'Whether there is a delay in filing' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].delayDays`, type: 'number', required: false, description: 'Number of days of delay in filing the particular return' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].valid`, type: 'string', required: false, description: 'Validity' },
    { field: `${prefix}filingStatus.result[].eFiledlist[].liabPct`, type: 'number', required: false, description: '(liabilityDetails) Liability percentage paid in GSTR-3B of the GSTIN' },
    { field: `${prefix}filingStatus.result[].financialYear`, type: 'string', required: false, description: 'Financial year to which returns pertain to' },
    { field: `${prefix}filingStatus.result[].filingFrequency`, type: 'array', required: false, description: 'Filing Frequency Details' },
    { field: `${prefix}filingStatus.result[].filingFrequency[].startPeriod`, type: 'string', required: false, description: 'Starting month of the quarter' },
    { field: `${prefix}filingStatus.result[].filingFrequency[].endPeriod`, type: 'string', required: false, description: 'Ending month of the quarter' },
    { field: `${prefix}filingStatus.result[].filingFrequency[].frequency`, type: 'string', required: false, description: 'Filing frequency for the quarter' },
    { field: `${prefix}filingStatus.result[].filingFrequency[].quarter`, type: 'string', required: false, description: 'Quarter pertaining to the Financial Year' },
    { field: `${prefix}filingStatus.result[].fyLiabPaidTotal`, type: 'number', required: false, description: '(liabilityDetails) Total Liability percentage paid for the financial year in GSTR-3B of the GSTIN' },
  ]
}

const EXAMPLE_GSTIN_ENTRIES = [
  {
    authStatus: 'Inactive', applicationStatus: '', emailId: '', gstinId: '19AAECP3450G1ZG',
    gstinRefId: '', mobNum: '', pan: 'AAECP3450G', regType: '', registrationName: '', tinNumber: '',
    profile: {}, filingStatus: {},
  },
  {
    authStatus: 'Active', applicationStatus: '', emailId: '', gstinId: '29AAECP3450G1ZF',
    gstinRefId: '', mobNum: '', pan: 'AAECP3450G', regType: '', registrationName: '', tinNumber: '',
    profile: {
      stjCd: 'KA012', dty: 'Regular', stj: 'LGSTO 045 - Bengaluru', lgnm: 'SINGULARITY FURNITURE PRIVATE LIMITED',
      adadr: [{ addr: 'NA', ntr: 'Warehouse / Depot', adr: 'P and T Layout, 88/89, Srigandadakaval, Sunkadhakatte, Karnataka, pin: 560091', em: '', lastUpdatedDate: 'NA', mb: '' }],
      cxdt: '', gstin: '29AAECP3450G1ZF',
      nba: ['Supplier of Services', 'Works Contract', 'Warehouse / Depot'],
      lstupdt: '29/05/2021', ctb: 'Private Limited Company', rgdt: '11/07/2018',
      pradr: { addr: 'NA', ntr: 'Supplier of Services, Works Contract', adr: 'Umiya Business Bay, 5th Floor, Tower 2, Cessna Business Park, Vartur Hobli, Outer Ring Road, Kadubeesanahalli, Karnataka', em: '', lastUpdatedDate: 'NA', mb: '' },
      ctjCd: 'YT0505', tradeNam: 'SINGULARITY FURNITURE PRIVATE LIMITED', sts: 'Active', ctj: 'RANGE-EED5',
      mbr: [], canFlag: 'NA', cmpRt: 'NA', contacted: { email: null, mobNum: null, name: null }, ppr: 'NA',
    },
    filingStatus: {
      gstin: '29AAECP3450G1ZF',
      complianceStatus: { isAnyDelay: true, isDefaulter: false },
      result: [
        {
          eFiledlist: [
            { valid: 'Y', mof: 'ONLINE', dof: '24-08-2021', retPrd: '042021', rtntype: 'GSTR3B', arn: 'AB2904211618913', status: 'Filed', dueDt: '2021-05-20', isDelay: true, delayDays: 96, liabPct: 100 },
            { valid: 'Y', mof: 'ONLINE', dof: '20-08-2021', retPrd: '042021', rtntype: 'GSTR1', arn: 'AB290421154512E', status: 'Filed', dueDt: '2021-05-26', isDelay: true, delayDays: 86, liabPct: null },
          ],
          financialYear: '2021-22',
          filingFrequency: [
            { startPeriod: '042021', endPeriod: '062021', frequency: 'Monthly', quarter: 'Q1' },
            { startPeriod: '072021', endPeriod: '092021', frequency: 'Monthly', quarter: 'Q2' },
          ],
          fyLiabPaidTotal: 105,
        },
      ],
    },
  },
]

const DEFAULT_REQUEST_BODY = JSON.stringify({
  pan: 'AAECP3450G',
  consent: 'Y',
  liabilityDetails: true,
  stateCode: ['29', '19', '33'],
  clientData: { caseId: '123456' },
}, null, 2)

function buildVariant(label: string, liabilityDetails: boolean): ApiVariant {
  return {
    label,
    request: {
      params: REQUEST_PARAMS,
      body: DEFAULT_REQUEST_BODY,
      headers: HEADERS_WITH_KEY,
    },
    response: {
      fields: [
        { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request' },
        { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request' },
        { field: 'result', type: 'array', required: true, description: 'Response object for the given inputs — one entry per GSTIN found for the PAN' },
        ...gstinEntryFields('result[].'),
        { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
        { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
      ],
      body: JSON.stringify({
        requestId: liabilityDetails ? '66eb3e64-6fe2-458d-a6c7-e8178535e0cd' : '2356c584-90fe-4fa9-9365-8194ad54af82',
        result: EXAMPLE_GSTIN_ENTRIES,
        statusCode: 101,
        clientData: { caseId: '123456' },
      }, null, 2),
      headers: HEADERS_JSON_ONLY,
    },
  }
}

export const GST_ADVANCED_VARIANTS: ApiVariant[] = [
  buildVariant('When liabilityDetails is true', true),
  buildVariant('When liabilityDetails is false or key is missing', false),
]

export { gstinEntryFields }
