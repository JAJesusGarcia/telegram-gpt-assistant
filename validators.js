const isValidFamilySize = (response) => {
  const size = parseInt(response, 10);
  return !isNaN(size) && size > 0;
};

const isValidIncome = (response) => {
  const income = parseFloat(response);
  return !isNaN(income) && income > 0;
};

const isValidGender = (response) => {
  const validGenders = ['male', 'female', 'other'];
  return validGenders.includes(response.toLowerCase());
};

const getErrorMessage = (state) => {
  const messages = {
    askingFamilySize: 'Please provide a valid number for your family size.',
    askingIncome: 'Please provide a valid amount for your household income.',
    askingGender:
      'Please respond with "male", "female", or "other" for your gender.',
  };
  return messages[state] || 'I didn’t quite get that. Could you try again?';
};

export { isValidFamilySize, isValidIncome, isValidGender, getErrorMessage };
