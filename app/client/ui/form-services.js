Template.loginServices.helpers({
  loginService() {
    return ServiceConfiguration.configurations
      .find(
        {
          type: { $eq: 'oauth' },
          hidden: { $ne: true },
        },
        {
          sort: {
            service: 1,
          },
        },
      )
      .fetch()
      .map(service => ({
        service,
        displayName: capitalize(service.service),
        icon: service.service,
      }));
  },
});

Template.loginServices.events({
  'click .external-login'(e) {
    if (this.service == null || this.service.service == null) {
      return;
    }
    console.log(this.service);

    const loadingIcon = $(e.currentTarget).find('.loading-icon');
    const serviceIcon = $(e.currentTarget).find('.service-icon');
    loadingIcon.removeClass('hidden');
    serviceIcon.addClass('hidden');
    const loginWithService = `loginWith${capitalize(this.service.service)}`;
    const serviceConfig = this.service || {};

    Meteor[loginWithService](serviceConfig);
  },
});
