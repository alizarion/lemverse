// eslint-disable-next-line
let userAgent = 'Meteor';
if (Meteor.release) {
  userAgent += `/${Meteor.release}`;
}
const getAccessToken = (name, query, config) => {
  if (!config) {
    throw new Error('OAuth no CONFIG');
  }

  let response;
  const options = {
    headers: {
      Accept: 'application/json', 'User-Agent': userAgent,
    },
    params: {
      code: query.code,
      client_id: config.clientId,
      client_secret: OAuth.openSecret(config.secret),
      redirect_uri: OAuth._redirectUri(name, config),
      state: query.state,
      grant_type: 'authorization_code',
    },
  };

  try {
    response = HTTP.post(config.accessTokenUrl, options);
  } catch (err) {
    throw Object.assign(new Error(`Failed to complete OAuth handshake. ${err.message}`), { response: err.response });
  }

  // if the http response was a json object with an error attribute
  if (response.data && response.data.error) {
    throw new Error(`Failed to complete OAuth handshak. ${response.data.error}`);
  } else {
    return response.data.access_token;
  }
};

const getIdentity = (accessToken, config) => {
  if (!config) {
    throw new ServiceConfiguration.ConfigError();
  }
  log('ICIIIIIIIIII getIdentity');

  let response;
  const options = {
    headers: { Accept: 'application/json', 'User-Agent': userAgent, Authorization: `Bearer ${accessToken}` },
  };

  try {
    response = HTTP.get(config.identityUrl, options);
  } catch (err) {
    const errorResponse = err.response;
    console.error(errorResponse.data);
    throw new Meteor.Error(errorResponse.statusCode || '500', 'lea.OAuth.getIdentity.failed', errorResponse);
  }

  return response && response.data;
};
const customOAuthConstructor = (name, config) => {
  Accounts.oauth.registerService(name);

  if (!config) {
    throw new Error(`OAuth: no config for service ${name}`);
  }

  OAuth.registerService(name, 2, null, query => {
    const accessToken = getAccessToken(name, query, config);
    const identity = getIdentity(accessToken, config);
    const sealedToken = OAuth.sealSecret(accessToken);

    const profile = {};
    (config.identity || []).forEach(key => {
      profile[key] = identity[key];
    });

    // we can now define in ServiceConfig additional fields that will not be saved
    // in user.profile but directly in the service data!
    const extraFields = {};
    (config.extraFields || []).forEach(key => {
      extraFields[key] = identity[key];
    });
    const data = {
      serviceData: {
        id: identity.sub,
        username:  identity.email,
        accessToken: sealedToken,
        email: identity.email || '',
        ...extraFields,
      },
      options: {
        profile: {
          ...profile,
          name: identity.name,
          shareAudio: true,
          shareVideo: true,
        },
      },
    };
    // Accounts.updateOrCreateUserFromExternalService('oauth', data.serviceData);
    return data;
  });
};

Accounts.registerLoginHandler(options => {
  log(`OAuth:registerLoginHandler ${JSON.stringify(options)} `);
});

Meteor.startup(() => {
  ServiceConfiguration.configurations
    .find()
    .observe({
      added(record) {
        log(`oauth ${JSON.stringify(record)}`);
        if (record.type === 'oauth') {
          customOAuthConstructor(record.service, record);
        }
      },
    });
});
