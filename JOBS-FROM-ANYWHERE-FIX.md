# Jobs from anywhere (v1.3.2)

**Cause:** Delivery / taxi / repair jobs required the open-city scene (`not_in_world`), so starting one from the phone inside a building, the Pleasure Park, campus etc. failed with "Jobs only work in the open city". Leaving the street also silently cancelled any active job.

**Fix**
- Jobs can be accepted from any scene. Outside the street the job is created from the last known city position and starts when you are back on the street (marker + road route are drawn on entry).
- Leaving the street pauses the job instead of cancelling it (the timer only runs on the street).
