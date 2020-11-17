{% for application in applications %}
image-assistant add-application --name #{application.id} --display-name #{application.displayName} --absolute-app-path #{application.path|safe}
{% endfor %}

