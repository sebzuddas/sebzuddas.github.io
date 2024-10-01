---
layout: projects
icon: fas fa-regular fa-atom
order: 1
---

<!-- <ol class="project-list">
{% for project in site.data.projects %}
  <li class="project-item">
    <a href="{{ site.url }}/{{ project.project_path }}/">{{ project.name }}</a>
  </li>
{% endfor %}
</ol> -->

<ol class="project-list">
{% for project in site.data.projects %}
  <li class="project-item">
    <a href="https://www.github.com/sebzuddas/{{ project.project_path }}/">{{ project.name }}</a>
  </li>
{% endfor %}
</ol>