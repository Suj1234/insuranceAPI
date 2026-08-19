import type { ApiVariant } from './api-definitions'

const HEADERS_WITH_KEY = `Content-Type : "application/json"\nx-karza-key: "<<YOUR KEY HERE>>"`
const HEADERS_JSON_ONLY = `Content-Type : "application/json"`

const DEFAULT: ApiVariant = {
  label: 'Digital footprint (mobile)',
  request: {
    params: [
      { name: 'consent', in: 'body', required: true, type: 'string', enum: ['Y', 'N'], description: 'Consent is required to make the API request.' },
      { name: 'mobile', in: 'body', required: true, type: 'string', placeholder: '9876543210', description: 'Mobile Number', example: 'pattern: ^[6-9]{1}[0-9]{9}$' },
      { name: 'phoneDetails', in: 'body', required: false, type: 'string', enum: ['Y', 'N'], description: 'If phone number related details are required.' },
      { name: 'statutoryPresenceRequired', in: 'body', required: false, type: 'string', enum: ['Y', 'N'], description: 'If Mobile to statutory presence related details are required' },
      { name: 'financialPresenceRequired', in: 'body', required: false, type: 'string', enum: ['Y', 'N'], description: 'If Mobile to financial Presence related details are required' },
      { name: 'rcLinkageRequired', in: 'body', required: false, type: 'string', enum: ['Y', 'N'], description: 'If Mobile to RC Linkage related details are required' },
      { name: 'clientData', in: 'body', required: false, type: 'object', description: 'Data of the user sharing consent' },
      { name: 'clientData.caseId', in: 'body', required: false, type: 'string', description: 'Unique case id/lead id of the user sharing consent', example: 'Max-length 200' },
    ],
    body: JSON.stringify({
      mobile: '9xxxxxxxx8',
      phoneDetails: 'Y',
      statutoryPresenceRequired: 'Y',
      financialPresenceRequired: 'Y',
      rcLinkageRequired: 'Y',
      consent: 'Y',
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_WITH_KEY,
  },
  response: {
    fields: [
      { field: 'statusCode', type: 'integer', required: true, description: 'Internal Status Code that denotes the status of the request.' },
      { field: 'requestId', type: 'string', required: true, description: 'Unique id of the API request.' },
      { field: 'result', type: 'object', required: true, description: 'Response object for the given inputs.' },
      { field: 'result.riskScore', type: 'integer', required: false, description: 'Risk Score against this mobile number' },
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
      { field: 'result.digitalPresence.financialpresence', type: 'integer', required: false, description: 'Count of financial channels associated with the user' },
      { field: 'result.phoneDetails', type: 'object', required: false, description: 'Network details' },
      { field: 'result.phoneDetails.countryName', type: 'string', required: false, description: 'Country of phone number' },
      { field: 'result.phoneDetails.isPorted', type: 'boolean', required: false, description: 'Whether the connection is ported' },
      { field: 'result.phoneDetails.subscriberStatus', type: 'string', required: false, description: 'Subscriber Status ["CONNECTED", "ABSENT", "UNKNOWN_MSISDN", "UNDETERMINED", "INVALID"]' },
      { field: 'result.phoneDetails.connectionStatusCode', type: 'string', required: false, description: 'Connection status code ["DELIVERED", "UNDELIVERED", "UNKNOWN", "REJECTED", "ERROR"]' },
      { field: 'result.phoneDetails.connectionType', type: 'string', required: false, description: 'Subscriber / connection type [Prepaid or Postpaid]' },
      { field: 'result.phoneDetails.currentProvider', type: 'string', required: false, description: 'Current mobile network provider' },
      { field: 'result.phoneDetails.originalProvider', type: 'string', required: false, description: 'Details of the original mobile network' },
      { field: 'result.phoneDetails.roamingProvider', type: 'string', required: false, description: 'Roaming details' },
      { field: 'result.phoneDetails.location', type: 'string', required: false, description: 'Location as per network' },
      { field: 'result.phoneDetails.currentServiceProviderNetworkName', type: 'string', required: false, description: 'Current service provider' },
      { field: 'result.phoneDetails.roamingServiceProviderNetworkName', type: 'string', required: false, description: 'Roaming service providers' },
      { field: 'result.phoneDetails.originalServiceProviderNetworkName', type: 'string', required: false, description: 'Original service providers' },
      { field: 'result.phoneDetails.mobileAge', type: 'string', required: false, description: 'Approximate age of the mobile number' },
      { field: 'result.phoneDetails.status', type: 'string', required: false, description: 'Current status of the number (Active, Inactive.)' },
      { field: 'result.seenInPastFraud', type: 'boolean', required: false, description: 'If this number was seen in any fraud in the past' },
      { field: 'clientData', type: 'object', required: true, description: 'Data of the user sharing consent' },
      { field: 'clientData.caseId', type: 'string', required: true, description: 'Unique case id/lead id of the user sharing consent' },
    ],
    body: JSON.stringify({
      requestId: 'bd633a60-3588-49c0-a2ee-8b8cc0d1fea8',
      result: {
        riskScore: 0,
        riskLevel: 'green',
        isEmployed: true,
        digitalPresence: { socialMedia: 1, essentials: 2, ecommerce: 3, educational: 0, entertainment: 1, statutoryPresence: 4, dating: 0, professional: 0, financialpresence: 3 },
        phoneDetails: {
          countryName: 'India', isPorted: false, subscriberStatus: 'CONNECTED', connectionStatusCode: 'DELIVERED',
          connectionType: null, currentProvider: 'idea', originalProvider: 'idea', roamingProvider: null,
          location: 'mumbai', currentServiceProviderNetworkName: 'IDEA // Mumbai', roamingServiceProviderNetworkName: null,
          originalServiceProviderNetworkName: 'IDEA // Mumbai', mobileAge: '10 to 11 Years', status: 'Active',
        },
        seenInPastFraud: false,
      },
      statusCode: 101,
      clientData: { caseId: '123456' },
    }, null, 2),
    headers: HEADERS_JSON_ONLY,
  },
}

export const DIGITAL_FOOTPRINT_MOBILE_VARIANTS: ApiVariant[] = [DEFAULT]
