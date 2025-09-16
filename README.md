# Day-Night Plugin

This plugin shows the [solar terminator lines](https://en.wikipedia.org/wiki/Terminator_(solar)) for the current timestamp. 

### Select lines:

- You can select lines for different altitudes (above or below the horizon).

### Sun Times:

- This table displays the different times,  for instance _sunrise_ and _sunset_, for the current picker position.
- By clicking on a line of this table,  you can select which time pair should be displayed in the picker.  
- or you can clear the picker.

### Time zone detail:

- Shows the name of the time zone.
- The current offset,  taking into account daylight saving time.
- The daylight saving time rule,  if applicable.  
- This is obtained from:  [iana.org/time-zones](https://www.iana.org/time-zones)
- The timezone polygons are obtained from: [Evan Siroky's project](https://github.com/evansiroky/timezone-boundary-builder/releases)
- The timezone data was last updated on:  14-Sep-2025.

### Settings:

- You can decide whether to use the windy time,  or select the time span for the _current year_.   If you select the full year,  the windy layer will switch to _Outdoor map_.
- Select whether to display local or UTC times in the picker.
- Use the left or right side of the picker,  this is useful if you want to combine plugins.
- Show shading for timezones.
- select whether to show the timezone polygon for the picker position.
- Set the opacity of the timezone shading.  

### Path to this plugin:

[windy.com/plugin/day-night/lat/lon/time](https://www.windy.com/plugin/day-night/0/0)

Time:  `yyyy-mm-ddThh:mm` or it can be any string that can be parsed by `new Date()`.  