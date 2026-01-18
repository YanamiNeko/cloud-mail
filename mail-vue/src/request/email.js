import http from '@/axios/index.js';

function buildParams(params) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && !Number.isNaN(value))
    );
}

export function emailList(accountId, allReceive, emailId, timeSort, size, type) {
    const params = buildParams({accountId, allReceive, emailId, timeSort, size, type});
    return http.get('/email/list', {params});
}

export function emailDelete(emailIds) {
    return http.delete('/email/delete?emailIds=' + emailIds)
}

export function emailLatest(emailId, accountId, allReceive) {
    const params = buildParams({emailId, accountId, allReceive});
    return http.get('/email/latest', {params, noMsg: true, timeout: 35 * 1000})
}

export function emailRead(emailIds) {
    return http.put('/email/read', {emailIds}, {noMsg: true})
}

export function emailSend(form,progress) {
    return http.post('/email/send', form,{
        onUploadProgress: (e) => {
            progress(e)
        },
        noMsg: true
    })
}
