{% for application in applications %}
choco install -y #{application.packageName}
{% endfor %}