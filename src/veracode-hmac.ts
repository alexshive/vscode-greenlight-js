import sjcl = require('sjcl');
import util = require('util');
import crypto = require('crypto');

function getAuthorizationScheme() { return "VERACODE-HMAC-SHA-256"; }
function getRequestVersion() { return "vcode_request_version_1"; }
function getNonceSize() { return 16; }

// function computeHash(message: string, key: string) {
//     var key_bits = sjcl.codec.utf8String.toBits(key);
//     var hmac_bits = (new sjcl.misc.hmac(key_bits, sjcl.hash.sha256)).mac(message);
//     var hmac = sjcl.codec.hex.fromBits(hmac_bits);
//     return hmac;
// }

function computeHashHex(message: string, key_hex: string) {
    var key_bits = sjcl.codec.hex.toBits(key_hex);
    var hmac_bits = (new sjcl.misc.hmac(key_bits, sjcl.hash.sha256)).mac(message);
    var hmac = sjcl.codec.hex.fromBits(hmac_bits);
    return hmac;
}

function calulateDataSignature(apiKeyBytes: string, nonceBytes: string, dateStamp: string, data: string) {
    var kNonce = computeHashHex(nonceBytes, apiKeyBytes);
    var kDate = computeHashHex(dateStamp, kNonce);
    var kSig = computeHashHex(getRequestVersion(), kDate);
    var kFinal = computeHashHex(data, kSig);
    return kFinal;
}

function newNonce(size: number) {
    return crypto.randomBytes(size).toString('hex').toUpperCase();
}

function toHexBinary(input: string) {
    return sjcl.codec.hex.fromBits(sjcl.codec.utf8String.toBits(input));
}

export function calculateAuthorizationHeader(id: string, key: string, hostName: string, uriString: string, urlQueryParams: string, httpMethod: string) {
    uriString += urlQueryParams;
    var data = util.format("id=%s&host=%s&url=%s&method=%s", id, hostName, uriString, httpMethod);
    var dateStamp = Date.now().toString();
    var nonceBytes = newNonce(getNonceSize());
    var dataSignature = calulateDataSignature(key, nonceBytes, dateStamp, data);
    var authorizationParam = util.format("id=%s,ts=%s,nonce=%s,sig=%s", id, dateStamp, toHexBinary(nonceBytes), dataSignature.toUpperCase());
    var header = getAuthorizationScheme() + " " + authorizationParam;
    return header;
}