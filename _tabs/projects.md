---
layout: projects
icon: fas fa-regular fa-atom
order: 1
---

<ol class="project-list">
{% for project in site.data.projects %}
  <li class="project-item">
    <a href="{{ site.url }}/{{ project.project_path }}/">{{ project.name }}</a>
  </li>
{% endfor %}
</ol>