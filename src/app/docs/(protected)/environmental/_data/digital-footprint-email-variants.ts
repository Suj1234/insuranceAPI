import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Digital footprint (email)',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'email', in: 'body', required: true, type: 'string', description: 'Email Id' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({ email: 'anurag.narkhede@gmail.com', consent: 'Y', clientData: { caseId: '123456' } }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.riskScore', type: 'integer', required: false, description: 'Risk Score against this email id' },
      { field: 'result.riskLevel', type: 'string', required: false, description: 'Risk level against this score - Red, Yellow, Green' },
      { field: 'result.isEmployed', type: 'boolean', required: false, description: 'Whether the individual is employed or not' },
      { field: 'result.digitalPresence', type: 'object', required: false, description: 'Digital Presence Information' },
      { field: 'result.digitalPresence.socialMedia', type: 'integer', required: false, description: 'Count of social media platform' },
      { field: 'result.digitalPresence.essentials', type: 'integer', required: false, description: 'Count of daily essential platform' },
      { field: 'result.digitalPresence.ecommerce', type: 'integer', required: false, description: 'Count of ecommerce platform' },
      { field: 'result.digitalPresence.educational', type: 'integer', required: false, description: 'Count of educational platform' },
      { field: 'result.digitalPresence.entertainment', type: 'integer', required: false, description: 'Count of entertainment platform' },
      { field: 'result.digitalPresence.statutoryPresence', type: 'integer', required: false, description: 'Count of statutory presence platform' },
      { field: 'result.digitalPresence.dating', type: 'integer', required: false, description: 'Count of dating app platform' },
      { field: 'result.digitalPresence.professional', type: 'integer', required: false, description: 'Count of Professional platform' },
      { field: 'result.emailDetails', type: 'object', required: false, description: 'Email related information' },
      { field: 'result.emailDetails.disposable', type: 'boolean', required: false, description: 'Whether the given email id is from a disposable email provider (i.e. non-authenticated public emails)' },
      { field: 'result.emailDetails.webmail', type: 'boolean', required: false, description: 'Whether the email address is from a free webmail provider' },
      { field: 'result.emailDetails.result', type: 'string', required: false, description: 'Overall validity result of the email' },
      { field: 'result.emailDetails.acceptAll', type: 'boolean', required: false, description: 'The SMTP server accepts all emails as valid via proxy (uncertain validity in this case)' },
      { field: 'result.emailDetails.smtpCheck', type: 'boolean', required: false, description: 'Whether the email id is accessible on the SMTP server (False implies it will bounce)' },
      { field: 'result.emailDetails.regexp', type: 'boolean', required: false, description: 'Whether the email id follows a valid regular expression' },
      { field: 'result.emailDetails.mxRecords', type: 'boolean', required: false, description: 'Whether mail exchanger records exist for the given email address' },
      { field: 'result.emailDetails.smtpServer', type: 'boolean', required: false, description: 'Whether the email id is accessible on the SMTP server (False implies it will bounce)' },
      { field: 'result.emailDetails.isBlocked', type: 'boolean', required: false, description: 'Email domain Blocked status' },
      { field: 'result.emailDetails.reason', type: 'string', required: false, description: 'The reason for the Email domain Blockage' },
      { field: 'result.seenInPastFraud', type: 'boolean', required: false, description: 'If this email was seen in any fraud in the past' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      requestId: '66a67f88-9ec6-4c06-8afa-aa0d3b56a81c',
      result: {
        riskScore: 0,
        riskLevel: 'green',
        isEmployed: false,
        digitalPresence: { socialMedia: 3, essentials: 3, ecommerce: 2, educational: 0, entertainment: 1, statutoryPresence: 0, dating: 0, professional: 7 },
        emailDetails: { disposable: false, webmail: false, result: 'valid', acceptAll: false, smtpCheck: true, regexp: true, mxRecords: true, smtpServer: true, isBlocked: false, reason: 'user_exist' },
        seenInPastFraud: null,
      },
      statusCode: 101,
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const DIGITAL_FOOTPRINT_EMAIL_VARIANTS: ApiVariant[] = [DEFAULT]
