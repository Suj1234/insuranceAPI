import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Silent bank account verification',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'accountNumber', in: 'body', required: true, type: 'string', description: 'Account number of the bank account to be verified', example: 'minLength: 5 maxLength: 25 pattern: ^[a-zA-Z0-9]+$' },
      { name: 'accountHolderName', in: 'body', required: false, type: 'string', description: 'Name of the account holder whose account is being verified', example: "pattern: ^[a-zA-Z0-9&,-/()_'. ]+$" },
      { name: 'ifsc', in: 'body', required: true, type: 'string', uppercase: true, description: 'IFSC of the bank branch to which the account belongs', example: 'pattern: ^[\\w]{4}0[\\w|\\d]{6}$' },
      { name: 'nameMatchType', in: 'body', required: false, type: 'string', description: 'Whether the account holder is an individual or an entity', example: 'Allowed Values: individual, entity' },
      { name: 'allowPartialMatch', in: 'body', required: false, type: 'boolean', description: 'To allow partial name match algorithm', example: 'Allowed values: true, false' },
      { name: 'preset', in: 'body', required: false, type: 'string', description: 'Strictness level of matching', example: 'Allowed Values: G(General), L(Lenient), S(Strict); Default value: G' },
      { name: 'suppressReorderPenalty', in: 'body', required: false, type: 'boolean', description: 'To suppress reordering of name token', example: 'Allowed values: true, false' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({
      accountNumber: '501xxxxxxxx679',
      accountHolderName: '',
      ifsc: 'HDFCxxxx810',
      consent: 'Y',
      nameMatchType: '',
      allowPartialMatch: true,
      preset: 'S',
      suppressReorderPenalty: true,
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.data', type: 'object', required: false, description: 'Response data for the given inputs' },
      { field: 'result.data.source', type: 'array', required: false, description: 'Data as per source for the given inputs' },
      { field: 'result.data.source[].statusAsPerSource', type: 'string', required: false, description: 'Validity Status as per source' },
      { field: 'result.data.source[].data', type: 'object', required: false, description: 'Response data from source' },
      { field: 'result.data.source[].data.bankTxnStatus', type: 'boolean', required: false, description: 'Bank Transaction Status' },
      { field: 'result.data.source[].data.accountNumber', type: 'string', required: false, description: 'Provided account number' },
      { field: 'result.data.source[].data.ifsc', type: 'string', required: false, description: 'Provided IFSC code' },
      { field: 'result.data.source[].data.accountName', type: 'string', required: true, description: 'Name of the account holder' },
      { field: 'result.data.source[].data.bankResponse', type: 'string', required: true, description: 'Bank response for the transaction' },
      { field: 'result.data.source[].data.bankRRN', type: 'string', required: true, description: 'Bank RRN for the transaction' },
      { field: 'result.data.source[].data.statusCode', type: 'string', required: false, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'result.data.source[].isValid', type: 'boolean', required: false, description: 'Validity Status' },
      { field: 'result.comparisonData', type: 'object', required: false, description: 'Comparison Data' },
      { field: 'result.comparisonData.inputVsSource', type: 'object', required: false, description: 'Comparison of Input vs Source data' },
      { field: 'result.comparisonData.inputVsSource.flags', type: 'object', required: false, description: 'Flags from Comparison data' },
      { field: 'result.comparisonData.inputVsSource.flags.accountHolderName', type: 'object', required: false, description: 'Comparison Results against Account Holder Name' },
      { field: 'result.comparisonData.inputVsSource.flags.accountHolderName.score', type: 'integer', required: false, description: 'Name Match Score' },
      { field: 'result.comparisonData.inputVsSource.flags.accountHolderName.result', type: 'boolean', required: true, description: 'Name Match Result' },
      { field: 'result.comparisonData.inputVsSource.validity', type: 'string', required: false, description: 'Validity Status as per comparison' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      statusCode: 101,
      requestId: '118b29e8-d7de-410c-98cf-a0849252e7ec',
      result: {
        data: {
          source: [
            {
              statusAsPerSource: 'VALID',
              data: {
                bankTxnStatus: true,
                accountNumber: '501xxxxxxxx679',
                ifsc: 'HDFCxxxx810',
                accountName: 'PERFIOS SOFTWARE SOLUTIONS PRIVATE LIMITED',
                bankResponse: 'SUCCESSFUL TRANSACTION',
                bankRRN: '214718512903',
                statusCode: 'KC01',
              },
              isValid: true,
            },
          ],
        },
        comparisonData: {
          inputVsSource: {
            flags: { accountHolderName: { score: 1, result: true } },
            validity: 'VALID',
          },
        },
      },
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const BANK_AC_SILENT_VARIANTS: ApiVariant[] = [DEFAULT]
