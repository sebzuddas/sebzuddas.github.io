---
layout: projects
icon: fas fa-regular fa-atom
order: 1
---

{% for project in site.data.projects %}
- [{{ project.name }}]({{ site.url }}/{{ project.project_path }}/)
{% endfor %}