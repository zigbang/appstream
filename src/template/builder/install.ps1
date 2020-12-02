{% for application in applications %}
choco install -y #{application.packageName}
{% endfor %}
{% for script in scripts %}
#{script|safe}
{% endfor %}