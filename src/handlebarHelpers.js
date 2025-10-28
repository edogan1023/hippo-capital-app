import hbs from "hbs";

export function registerHandlebarHelpers(hbs) {
  //helper to convert underscores to spaces used in accounts account_type changes  currently not being used
  hbs.registerHelper('underscoreToSpace', function(text) {
    if (!text) return '';
    return text.replace(/_/g, ' ');
  });

  // helper to format date
  hbs.registerHelper('formatDate', function(date) {
    return new Date(date).toDateString().slice(4);
  });

    // helper to format date AND time
  hbs.registerHelper('formatDateTime', function(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toDateString().slice(4) + ' ' +
        d.toTimeString().split(' ')[0];
  });


    // helper to capitalize first letter of each word as well as convert underscores to spaces
  hbs.registerHelper('capitalizeLetter', function(str) {
    if (!str) return '';
    const withSpaces = str.replace(/_/g, ' ');
    return withSpaces.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  });

    // helper to format numbers with commas
  hbs.registerHelper('formatNumber', function(number) {
    if (number == null) return '';
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  });


// Returns "Active" / "Inactive"
  hbs.registerHelper("statusText", function (isActive) {
    return isActive ? "Active" : "Inactive";
  });

// Row background color class
  hbs.registerHelper("rowClass", function (isActive) {
    return isActive ? "bg-white" : "bg-gray-200";
  });


    // Helper to format user full name with initials for middle names
  hbs.registerHelper('formatFullName', function(first_name, middle_name, surname) {
    // Capitalize first letter of first name
    const firstName = first_name.charAt(0).toUpperCase() + first_name.slice(1).toLowerCase();

    // Handle middle names -> initials
    let middleInitials = '';
    if (middle_name && middle_name.trim() !== '') {
      middleInitials = middle_name
          .split(' ')
          .map(name => name.charAt(0).toUpperCase() + '.') // first letter + dot
          .join(' ');
    }

    // Capitalize surname
    const lastName = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();

    // Combine parts
    if (middleInitials) {
      return `${firstName} ${middleInitials} ${lastName}`;
    } else {
      return `${firstName} ${lastName}`;
    }
  });

  // equal check
    hbs.registerHelper('eq', function (a, b) {
      return a === b;
    });

  // logical OR
    hbs.registerHelper('or', function () {
      const args = Array.prototype.slice.call(arguments, 0, -1); // drop handlebars options obj
      return args.some(Boolean);
    });

  // logical AND
    hbs.registerHelper('and', function () {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.every(Boolean);
    });

  // length of an array
    hbs.registerHelper('length', function (arr) {
      return Array.isArray(arr) ? arr.length : 0;
    });

  // greater than or equal
    hbs.registerHelper('gte', function (a, b) {
      return a >= b;
    });

    // less than or equal
    hbs.registerHelper('lte', function (a, b) {
      return a <= b;
    });

    //kinda don't know where its used could delete it maybe
    hbs.registerHelper('firstLetter', function(str) {
      return str && str.length > 0 ? str[0] : '';
    });


}


