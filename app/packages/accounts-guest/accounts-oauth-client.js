/* eslint-disable */
/* globals ServiceConfiguration, capitalize, Hook, LoginState: true */
"use strict";
const capitalizeFirstLetter = ([first, ...rest], locale = navigator.language) =>
    first.toLocaleUpperCase(locale) + rest.join('')
const customOAuthConstructor = (name, config) => {

    if (!Match.test(name, String)) {
        throw new Meteor.Error('CustomOAuth: Name is required and must be String');
    }
    Accounts.oauth.registerService(name);


    if (!Match.test(config, Object)) {
        throw new Meteor.Error('CustomOAuth: Options is required and must be Object');
    }

    if (!Match.test(config.authUrl, String)) {
        config.authUrl = '/oauth/authorize';
    }

    if (!Match.test(config.scope, String)) {
        config.scope = 'openid';
    }

    config.responseType = config.responseType || 'code';


    const loginWithService = `loginWith${capitalize(name)}`;

    Meteor[loginWithService] = (options, callback) => {
        // support a callback without options
        if (!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }

        const credentialRequestCompleteCallback = Accounts.oauth.credentialRequestCompleteHandler(callback);
        const config = ServiceConfiguration.configurations.findOne({service: name});
        if (!config) {
            if (credentialRequestCompleteCallback) {
                credentialRequestCompleteCallback(new ServiceConfiguration.ConfigError());
            }
            return;
        }

        const credentialToken = Random.secret();
        const loginStyle =OAuth._loginStyle(name, config, options);

        const separator = options.authUrl.indexOf('?') !== -1 ? '&' : '?';

        const loginUrl =
            `${options.authUrl}${separator}client_id=${config.clientId}&redirect_uri=${encodeURIComponent(
                OAuth._redirectUri(name, config),
            )}&response_type=${encodeURIComponent(options.responseType)}` +
            `&state=${encodeURIComponent(OAuth._stateParam(loginStyle, credentialToken, options.redirectUrl))}&scope=${encodeURIComponent(
                options.scope,
            )}`;

        OAuth.launchLogin({
            loginService: name,
            loginStyle,
            loginUrl,
            credentialRequestCompleteCallback: Accounts.oauth.credentialRequestCompleteHandler(callback),
            credentialToken,
            popupOptions: {
                width: 900,
                height: 450,
            },
        });
    }
}

// no non-logged in users
/* you might need to limit this to avoid flooding the user db */
Meteor.startup(() => {
    Deps.autorun(() => {
       const idpHint =  FlowRouter.current().queryParams.idpHint
        ServiceConfiguration.configurations
            .find()
            .observe({
                added(record) {
                    console.log('record.type',record.type)
                    if (record.type === 'oauth') {
                        customOAuthConstructor(record.service, record);
                        if(idpHint && idpHint === record.service && !OAuth.getDataAfterRedirect()){
                            const loginExternal = `loginWith${capitalize(record.service)}`;
                            Meteor[loginExternal](record)
                        }
                    }
                },
            });
    });
});

capitalize = capitalizeFirstLetter