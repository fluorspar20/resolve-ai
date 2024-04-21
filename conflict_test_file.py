def is_leap_year(year):
    ''' Adding this to test commit listener part 5'''
    """
    Function to check if a given year is a leap year or not.
    
    Args:
    - year: Integer representing the year to check.
    
    Returns:
    - True if the year is a leap year, False otherwise.
    """
    if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):
        return True
    else:
        return False

def main():
    year = int(input("Enter a year: "))
    if is_leap_year(year):
        print(f"{year} is a leap year.")
    else:
        print(f"{year} is not a leap year.")

if __name__ == "__main__":
    main()
