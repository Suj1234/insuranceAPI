import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Bank AC verification',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'accountNumber', in: 'body', required: true, type: 'string', description: 'Account number to be verified.', example: 'minLength: 5 maxLength: 25 pattern: ^[a-zA-Z0-9]+$' },
      { name: 'accountHolderName', in: 'body', required: false, type: 'string', description: 'Name of the account holder whose account is being verified (either accountHolderName or multiNameList to be passed)', example: 'pattern: ^[a-zA-Z0-9&,-/()_\'. ]+$' },
      { name: 'multiNameList', in: 'body', required: false, type: 'array', description: 'Multiple names that needs to be matched with bank name (either accountHolderName or multiNameList to be passed)' },
      { name: 'ifsc', in: 'body', required: true, type: 'string', uppercase: true, description: 'IFSC code of the home branch of the account.', example: 'pattern: ^[\\w]{4}0[\\w|\\d]{6}$' },
      { name: 'nameMatchType', in: 'body', required: false, type: 'string', description: 'Whether the account holder is an individual or an entity', example: 'Allowed Values: individual, entity' },
      { name: 'useCombinedSolution', in: 'body', required: false, type: 'string', description: 'To be passed when combined solution needs to be used (Nonpenny + pennydrop)', example: 'Allowed Values: Y' },
      { name: 'allowPartialMatch', in: 'body', required: false, type: 'boolean', description: 'To allow partial name match algorithm', example: 'Allowed values: true, false' },
      { name: 'preset', in: 'body', required: false, type: 'string', description: 'Strictness level of matching', example: 'Allowed Values: G(General), L(Lenient), S(Strict); Default value: G' },
      { name: 'suppressReorderPenalty', in: 'body', required: false, type: 'boolean', description: 'To suppress reordering of name token', example: 'Allowed values: true, false' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({
      accountNumber: '100xxxxx979',
      accountHolderName: 'PERFIOS SOFTWARE SOLUTIONS PRIVATE LIMITED',
      multiNameList: ['Perfios', 'Boyapati', 'Technologies'],
      ifsc: 'IDFBxxxx101',
      consent: 'Y',
      nameMatchType: 'Entity',
      useCombinedSolution: 'Y',
      allowPartialMatch: true,
      preset: 'G',
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
      { field: 'result.data.source[].data.accountNumber', type: 'string', required: false, description: 'Provided account number' },
      { field: 'result.data.source[].data.ifsc', type: 'string', required: false, description: 'Provided IFSC code' },
      { field: 'result.data.source[].data.accountName', type: 'string', required: true, description: 'Name of the account holder' },
      { field: 'result.data.source[].data.bankResponse', type: 'string', required: true, description: 'Bank response for the transaction' },
      { field: 'result.data.source[].data.bankTxnStatus', type: 'boolean', required: true, description: 'Bank Transaction Status' },
      { field: 'result.data.source[].data.bankRRN', type: 'string', required: true, description: 'Bank RRN for the transaction' },
      { field: 'result.data.source[].data.statusCode', type: 'string', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'result.data.source[].isValid', type: 'boolean', required: false, description: 'Validity Status' },
      { field: 'result.data.identifier', type: 'string', required: false, description: 'Identification of the transaction processed through framework (NON_PENNY OR PENNY)' },
      { field: 'result.comparisionData', type: 'object', required: false, description: 'Comparison Data' },
      { field: 'result.comparisionData.inputVsSource', type: 'object', required: false, description: 'Comparison of Input vs Source data' },
      { field: 'result.comparisionData.inputVsSource.flags', type: 'object', required: false, description: 'Flags from Comparison data' },
      { field: 'result.comparisionData.inputVsSource.flags.accountHolderName', type: 'object', required: false, description: 'Comparison Results against Account Holder Name' },
      { field: 'result.comparisionData.inputVsSource.flags.multiNameList', type: 'object', required: false, description: 'Multi name match List' },
      { field: 'result.comparisionData.inputVsSource.flags.multiNameList.matches', type: 'array', required: false, description: 'Match score and result for all the names provided' },
      { field: 'result.comparisionData.inputVsSource.flags.multiNameList.matches[].score', type: 'float', required: false, description: 'Name Match Score' },
      { field: 'result.comparisionData.inputVsSource.flags.multiNameList.matches[].result', type: 'boolean', required: true, description: 'Name Match Result' },
      { field: 'result.comparisionData.inputVsSource.flags.multiNameList.matches[].name', type: 'string', required: false, description: 'Name provided for matching with the standard given name' },
      { field: 'result.comparisionData.inputVsSource.flags.multiNameList.combinedScore', type: 'float', required: false, description: 'Combined score of base name with multiple names provided in the input.' },
      { field: 'result.comparisionData.inputVsSource.validity', type: 'string', required: false, description: 'Validity Status as per comparison' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      requestId: 'ee79852b-e3e5-4ae4-b2ef-d81442664be2',
      result: {
        data: {
          source: [
            {
              statusAsPerSource: 'VALID',
              data: {
                accountNumber: '10052056979',
                ifsc: 'IDFB0040101',
                accountName: 'PERFIOS SOFTWARE SOLUTIONS PRIVATE LIMITED',
                bankResponse: 'SUCCESSFUL TRANSACTION',
                bankTxnStatus: true,
                bankRRN: '521311711179',
                statusCode: 'KC01',
              },
              isValid: true,
            },
          ],
          identifier: 'NON_PENNY',
        },
        comparisionData: {
          inputVsSource: {
            flags: {
              multiNameList: {
                matches: [
                  { score: 0.905, result: true, name: 'Perfios' },
                  { score: 0.15076399733723234, result: false, name: 'Boyapati' },
                  { score: 0.14811483597375216, result: false, name: 'Technologies' },
                ],
                combinedScore: 0.4012929444369948,
              },
            },
            validity: 'VALID',
          },
        },
      },
      statusCode: 101,
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const BANK_AC_ADVANCED_VARIANTS: ApiVariant[] = [DEFAULT]
