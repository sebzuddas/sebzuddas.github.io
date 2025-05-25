---
layout: post
title: The MPC Journal
description: The MPC Journal - an optimal framework for a complex life
image: 
    path: https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWYxeDZzYWJ3YzBianJuZ2JnOXJ1dGpxNHJibXI3b29hbDdqcTJycSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/lbcLMX9B6sTsGjUmS3/giphy.gif
    alt: MPC
categories:
tags:
math: false
mermaid: false
---

# Why Rethink Personal Planning?
You are complex. Life is complex. Things change all the time. Have you ever tried to stick to a plan just for something to get in the way? Do your interests evolve over time, starting projects and not finishing them? Does your planning become less relevant when you learn something new, or an opportunity arises that you didn't anticipate?

These are the drawbacks I found when using traditional 'planning' techniques. Gantt charts, Kanban and other techniques that are used to plan things don't have the flexibility to help you ensure that your goals are consistently relevant to your every day. 


# What is MPC
[Model Predictive Control](https://wiki.sebzuddas.com/Systems/Control-Systems/MPC/Model-Predictive-Control-(MPC)) is a model-based control approach that is used for complex, non-linear systems. The premise is simple: 
1. You have a model, an understanding of how something works, its limitations and the environment in which it sits. 
2. You use your understanding of the model to formulate an **optimal** set of steps to reach the desired 'goal state', working backwards from the goal. 
3. At each iteration, you only enact the first optimal step, after which you reformulate your optimal set of steps. 
This approach ensures that the controller works optimally in the short-term, whilst maintaining its long-term goal. 

MPC is essentially a controller that thinks ahead, choosing actions that are not just good now, but will remain good in the near future, all while obeying the rules of the system. This makes it ideal for many real-world applications.

Below you can see MPC working in a simulation. There is a car that is using MPC, the user clicks certain points in the screen to determine where the car should go - the target. The car then pursues each of the targets optimally. 

![example mpc](https://dynorobotics.se/wp-content/uploads/2022/02/ezgif.com-gif-maker-4.gif)

# The MPC Journal
The MPC journal applies the same approach that MPC does but to your life, replacing traditional, linear planning techniques with something that is both dynamic and optimal. It facilitates flexibility whilst enabling long-term thinking. Most importantly it encourages engagement, and you can choose how engaged you want to be. 

## Nested Iterations
Where the MPC journal diverges from traditional techniques is its use of 'nested iterations'