import math
import statistics
from microseil import BakerPerformance, get_session
import queries as tezos
import service_utils


GRADING_RANGE = 64


def int_to_grade(int):
    """Returns letter equivalent of an integer"""
    
    conversion = ["", "A", "B", "B+", "C", "D", "F"]    
    return conversion[int]


def grade_to_int(grade):
    """Returns an integer equivilent of a letter grade"""

    conversion = {"A": 1, "B": 2, "B+":3, "C":4, "D": 5, "F":6}
    return conversion[grade.replace("*", "")]


def t_to_grade(t):
    """Returns letter grade from a t-score"""

    if t < -0.25:
        return "A"
    elif t <.26:
        return "B+"
    elif t < .54:
        return "B"
    elif t < .85:
        return "C"
    elif t < 1.65:
        return "D"
    else:
        return "F"


def calculate_partial_grades(stats, pos, neg):
    """General purpose function to grade the performance of a baker using a
    given field

    This function uses stats to calculate the mean performance of the particular
    metric for the population and then compares this to the many sample means
    taken from the performance of each individual baker. 

    Parameters: 
        stats: {pos: int, neg: int} Dictionary of values containing the
            performance metric to be analyzed. Should have values for at least 30
            cycles 
        pos: (string) Name of the field in stats which is the positive
            aspect of the performance metric (eg. blocks baked) 
        neg: (string) Name
            of the field in stats which is the negative aspect of the performance
            metric (eg. blocks missed)
    """

    sum_successful = 0
    sum_missed = 0
    data = {}
    
    # For baker in the dataset, create a dictionary accumulating the number of
    # positive/negative points per cycle. Keep track of a global sum as well

    for item in stats:
        if item["baker"] in data.keys():
            data[item["baker"]]["successful"].append(item[pos])
            data[item["baker"]]["missed"].append(item[neg])
        else:
            data[item["baker"]]= {"successful": [item[pos]], "missed": [item[neg]]}

        sum_successful += item[pos]
        sum_missed += item[neg]

    # Calculate the average of the population using the global sums

    mu = float(sum_missed/(sum_successful + sum_missed))
    
    # Look through the array of data points for a particular baker. Calculate
    # the (negative/sample sum) ratio and throw out cycles where there was no
    # baker activity
    
    grades = {}
    for i in data.keys():
        n = len(data[i]["successful"])
        ratios = []
        for k in range(n):
            num_baked = data[i]["successful"][k]
            num_missed = data[i]["missed"][k]
            tot = num_baked + num_missed
            if tot != 0:
                ratios.append(float(num_missed/tot))

    # Calculate the sample mean, xbar, and sample variance, S, for the baker. Do
    # this if the baker has at least 2 periods worth of data (16 cycles)
    
        if len(ratios) >= 16:
            xbar = statistics.mean(ratios)
          
            # If the baker doesn't have at least 30 data points, we extrapolate to 30
            # points in order to apply the CLT and avoid using a t-distribution

            n = len(ratios) if len(ratios) > 30 else 30
            sigma = statistics.stdev(ratios)
            if sigma == 0:
                sigma = .000000000000000001            

            # Calculate the t-value
            
            t = (xbar-mu)/(sigma/math.sqrt(n))
            grades[i] = t_to_grade(t)
            
            # Add an asterisk if the grade was exrapolated
            
            if len(ratios) < 30: grades[i] += "*"   
            
    return grades


# TODO: optimize this
def get_grading_stats_for_cycle(cycle):    
    """Retrieves the necessary data needed to calculate grades in a given cycle"""

    session = get_session()
    query = session.query
    response = query(BakerPerformance.baker, BakerPerformance.num_baked, BakerPerformance.num_missed, 
                    BakerPerformance.high_priority_endorsements, BakerPerformance.missed_endorsements, BakerPerformance.cycle).filter(
                BakerPerformance.cycle.between(cycle-GRADING_RANGE, cycle)
                 ).all()
    session.close()
    stats = []
    for entry in response:
        baker, num_baked, num_missed, high_priority_endorsements, missed_endorsements, cycle = entry
        stats.append({"baker": baker,"cycle":cycle, "num_baked": num_baked, "num_missed": num_missed,
            "high_priority_endorsements": high_priority_endorsements, "missed_endorsements": missed_endorsements})
    return stats


def average_grade_for(baker, baking_grades, endorsing_grades):
    """Take two letter grades for a baker and return the average

    If the baker only has an endorsing grade, only that will be returned. If
    there was not enough data to calculate any grade for a baker, return a
    pending status

    Parameters:
        baker: (string) Public key of the baker
        baking_grades: {pkh (string): grade (string)} Dictionary of all of the
            baking grades calculated for that cycle
        endorsing_grades: {pkh (string): grade (string)} Dictionary of all of the
            endorsing grades calculated for that cycle
    """
    
    baking_grade = baking_grades.get(baker, "Pending...")    
    endorsing_grade = baking_grades.get(baker, "Pending...")    
    if (baking_grade == "Pending..."): return endorsing_grade
    avg_grade = int_to_grade(int(round((grade_to_int(baking_grade) + grade_to_int(endorsing_grade))/2.0)))
    if ("*" in baking_grade or "*" in endorsing_grade):
        avg_grade += "*"
    return avg_grade


@service_utils.update_for_key_in_cycle(BakerPerformance, BakerPerformance.baker, BakerPerformance.grade)
def populate_grades(cycle):
    """Populates all the grade column for every baker in the baking_performance
    table for a particular cycle"""
    
    stats = get_grading_stats_for_cycle(cycle)
    baking_grades = calculate_partial_grades(stats, "num_baked", "num_missed") 
    endorsing_grades = calculate_partial_grades(stats, "high_priority_endorsements", "missed_endorsements")
    grades = {}
    bakers = tezos.all_bakers()
    
    for baker in bakers:
        grades[baker] = average_grade_for(baker, baking_grades, endorsing_grades)
    return grades

