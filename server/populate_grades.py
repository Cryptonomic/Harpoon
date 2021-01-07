import service_utils
from microseil import BakerPerformance, get_session
import queries as tezos
import statistics, math

GRADING_RANGE = 64

def int_to_grade(int):
    conversion = ["", "A", "B", "B+", "C", "D", "F"]    
    return conversion[int]


def grade_to_int(grade):
    conversion = {"A": 1, "B": 2, "B+":3, "C":4, "D": 5, "F":6}
    return conversion[grade.replace("*", "")]


def t_to_grade(t):
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
    sum_successful = 0
    sum_missed = 0
    data = {}
    for item in stats:
        if item["baker"] in data.keys():
            data[item["baker"]]["successful"].append(item[pos])
            data[item["baker"]]["missed"].append(item[neg])
        else:
            data[item["baker"]]= {"successful": [item[pos]], "missed": [item[neg]]}

        sum_successful += item[pos]
        sum_missed += item[neg]

    mu = float(sum_missed/(sum_successful + sum_missed))
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
        if len(ratios) >= 16:
            xbar = statistics.mean(ratios)
            n = len(ratios) if len(ratios) > 30 else 30
            sigma = statistics.stdev(ratios)
            if sigma == 0:
                sigma = .000000000000000001            
            t = (xbar-mu)/(sigma/math.sqrt(n))
            grades[i] = t_to_grade(t)
            if len(ratios) < 30: grades[i] += "*"   
            
    return grades


# TODO: optimize this
def get_grading_stats_for_cycle(cycle):    
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
    baking_grade = baking_grades.get(baker, "Pending...")    
    endorsing_grade = baking_grades.get(baker, "Pending...")    
    if (baking_grade == "Pending..."): return endorsing_grade
    avg_grade = int_to_grade(int(round((grade_to_int(baking_grade) + grade_to_int(endorsing_grade))/2.0)))
    if ("*" in baking_grade or "*" in endorsing_grade):
        avg_grade += "*"
    return avg_grade


@service_utils.update_for_key_in_cycle(BakerPerformance, BakerPerformance.baker, BakerPerformance.grade)
def populate_grades(cycle):
    stats = get_grading_stats_for_cycle(cycle)
    baking_grades = calculate_partial_grades(stats, "num_baked", "num_missed") 
    endorsing_grades = calculate_partial_grades(stats, "high_priority_endorsements", "missed_endorsements")
    grades = {}
    bakers = tezos.all_bakers()
    for baker in bakers:
        grades[baker] = average_grade_for(baker, baking_grades, endorsing_grades)
    return grades

