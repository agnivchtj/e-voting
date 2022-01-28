#include "shim.h"
#include "election_cc.h"
#include "election_json.h"

#include <numeric>
#include <vector>

#define MAX_VALUE_SIZE 1024

#define OK "OK"
#define ELECTION_DRAW "DRAW"
#define ELECTION_NO_VOTES "NO_VOTES"
#define ELECTION_ALREADY_EXISTS "ELECTION_ALREADY_EXISTS"
#define ELECTION_DOES_NOT_EXIST "ELECTION_DOES_NOT_EXIST"
#define ELECTION_ALREADY_CLOSED "ELECTION_ALREADY_CLOSED"
#define ELECTION_STILL_OPEN "ELECTION_STILL_OPEN"
#define VOTE_DOES_NOT_EXIST "VOTE_DOES_NOT_EXIST"
#define VOTE_NOT_FOUND "VOTE_NOT_FOUND"

#define INITIALIZED_KEY "initialized"
#define ELECTION_NAME_KEY "election_name"
#define CLIENT_READ_FAILED "failed_to_read_client"
#define CLIENT_DECODE_FAILED "failed_to_decode_clientID"


// Initialize the election
std::string initElection(std::string _election_, shim_ctx_ptr_t ctx)
{
    put_state(
        ELECTION_NAME_KEY, 
        (uint8_t*)_election_.c_str(),
        _election_.size(), 
        ctx
    );

    bool _initialized_ = true;
    put_state(INITIALIZED_KEY, (uint8_t*)&_initialized_, sizeof(_initialized_), ctx);

    return OK;
}


// We create the election with up to 3 candidates
std::string createElection(
    std::string election_name, 
    std::string candidate_one, std::string candidate_two, std::string candidate_three, 
    shim_ctx_ptr_t ctx
) 
{
    // check if election already exists
    uint32_t election_bytes_len = 0;
    uint8_t election_bytes[MAX_VALUE_SIZE];
    get_state(
        election_name.c_str(), 
        election_bytes, 
        sizeof(election_bytes), 
        &election_bytes_len, 
        ctx
    );

    if (election_bytes_len > 0)
    {
        LOG_DEBUG("This election already exists!");
        return ELECTION_ALREADY_EXISTS;
    }

    // create new election
    election_t new_election;
    new_election.name = (char*)election_name.c_str();
    new_election.organizer = get_creator_name('org1msp', (uint8_t*)election_name.c_str(), election_name.size(), ctx)
    new_election.winner = "";
    new_election.num_votes = 0;
    new_election.status = "open";

    // Create the candidates
    new_election.candidate_one = (char*)candidate_one.c_str();
    new_election.candidate_two = (char*)candidate_two.c_str();
    new_election.candidate_three = (char*)candidate_three.c_str();

    // convert to json string and store
    std::string json = marshal_election(&new_election);
    put_state(election_name.c_str(), (uint8_t*)json.c_str(), json.size(), ctx);

    return OK;
}

election_t queryElection(std::string election_name, shim_ctx_ptr_t ctx) 
{
    // check if election already exists
    uint32_t election_bytes_len = 0;
    uint8_t election_bytes[MAX_VALUE_SIZE];
    get_state(election_name.c_str(), election_bytes, sizeof(election_bytes), &election_bytes_len, ctx);

    if (election_bytes_len == 0)
    {
        LOG_DEBUG("Election needs to already exist!");
        return ELECTION_DOES_NOT_EXIST;
    }

    election_t election;
    unmarshal_election(&election, (const char*)election_bytes, election_bytes_len);

    LOG_DEBUG(
        "Election - Name: (%s) Candidates: (%s, %s, %s) Status (%d)", 
        election.name.c_str(), 
        election.candidate_one.c_str(), election.candidate_two.c_str(), election.candidate_three.c_str(), 
        election.status
    );

    return election;
}

std::string submitVote(
    std::string election_name, std::string voter_name, std::string vote_to, shim_ctx_ptr_t ctx
) 
{
    // check if election already exists
    uint32_t election_bytes_len = 0;
    uint8_t election_bytes[MAX_VALUE_SIZE];
    get_state(election_name.c_str(), election_bytes, sizeof(election_bytes), &election_bytes_len, ctx);

    if (election_bytes_len == 0)
    {
        LOG_DEBUG("Election needs to already exist!");
        return ELECTION_DOES_NOT_EXIST;
    }

    // check if election is closed
    election_t election;
    unmarshal_election(&election, (const char*)election_bytes, election_bytes_len);

    if (!election.status) {
        LOG_DEBUG("Election must be open to submit new votes.");
        return ELECTION_ALREADY_CLOSED;
    }

    // Create composite key to encrypt vote
    // If vote already exists, we just overwrite it
    std::string new_key("\u00" + election_name + "\u0" + voter_name + "\u0");

    vote_t new_vote;
    new_vote.vote_from = voter_name;
    new_vote.vote_to = vote_to;

    // convert to json and store
    std::string json = marshal_vote(&new_vote);
    put_state(new_key.c_str(), (uint8_t*)json.c_str(), json.size(), ctx);

    return OK;
}

std::string closeElection(std::string election_name, shim_ctx_ptr_t ctx) 
{
    // check if election already exists
    uint32_t election_bytes_len = 0;
    uint8_t election_bytes[MAX_VALUE_SIZE];
    get_state(election_name.c_str(), election_bytes, sizeof(election_bytes), &election_bytes_len, ctx);

    if (election_bytes_len == 0)
    {
        LOG_DEBUG("Election needs to exist!");
        return ELECTION_DOES_NOT_EXIST;
    }

    // get election struct from json
    election_t election;
    unmarshal_election(&election, (const char*)election_bytes, election_bytes_len);

    if (!election.status)
    {
        LOG_DEBUG("Election is already closed.");
        return ELECTION_ALREADY_CLOSED;
    }

    // close election
    election.status = false;

    // convert to json and store in state
    std::string json = marshal_election(&election);
    put_state(election_name.c_str(), (uint8_t*)json.c_str(), json.size(), ctx);

    return OK;
}

std::string queryVote(std::string election_name, std::string voter_name, shim_ctx_ptr_t ctx) 
{
    // Check if election exists
    uint32_t election_bytes_len = 0;
    uint8_t election_bytes[MAX_VALUE_SIZE];
    get_state(
        election_name.c_str(), 
        election_bytes, 
        sizeof(election_bytes), 
        &election_bytes_len, 
        ctx
    );

    if (election_bytes_len == 0) 
    {
        LOG_DEBUG("Election needs to exist.");
        return ELECTION_DOES_NOT_EXIST;
    }

    election_t election;
    unmarshal_election(&election, (const char*)election_bytes, election_bytes_len);

    // Get the votes w/ partial composite key
    std::string voter_key = "\u00" + election_name + "\u0";
    std::map<std::string, std::string> votes;
    get_state_by_partial_composite_key(voter_key.c_str(), votes, ctx);

    if (votes.empty()) 
    {
        LOG_DEBUG("There are no votes!");
        return ELECTION_NO_VOTES;
    }

    for (auto v : votes) 
    {
        vote_t vote;
        unmarshal_vote(&vote, v.second.c_str(), v.second.size());

        // Vote found
        if (vote.vote_from == voter_name) 
        {
            LOG_DEBUG(
                "Vote - Voter: %s, Vote to: %s", 
                vote.vote_from.c_str(), 
                vote.vote_to.c_str()
            );
            return OK;
        }
    }

    LOG_DEBUG("No vote has been found by this voter.");
    return VOTE_NOT_FOUND;
}

std::string evaluateElection(std::string election_name, shim_ctx_ptr_t ctx) 
{
    // check if election already exists
    uint32_t election_bytes_len = 0;
    uint8_t election_bytes[MAX_VALUE_SIZE];
    get_state(
        election_name.c_str(), 
        election_bytes, 
        sizeof(election_bytes), 
        &election_bytes_len, 
        ctx
    );

    if (election_bytes_len == 0)
    {
        LOG_DEBUG("Election needs to exist!");
        return ELECTION_DOES_NOT_EXIST;
    }

    // get election struct from json
    election_t election;
    unmarshal_election(&election, (const char*)election_bytes, election_bytes_len);

    // check if election is closed
    if (election.status)
    {
        LOG_DEBUG("Election must be closed to evaluate winner.");
        return ELECTION_STILL_OPEN;
    }

    // the winner of the election
    std::string election_result;

    // get all votes
    std::string vote_composite_key = "\u00" + election_name + "\u0";
    int c_one_count = 0;
    int c_two_count = 0;
    int c_three_count = 0;
    std::map<std::string, std::string> votes;
    get_state_by_partial_composite_key(vote_composite_key.c_str(), votes, ctx);

    if (votes.empty())
    {
        LOG_DEBUG("There are no votes submitted.");
        election_result = ELECTION_NO_VOTES;
    }
    else
    {
        // Find candidate w/ most votes
        LOG_DEBUG("All considered votes:");
        for (auto v : votes)
        {
            vote_t vote;
            unmarshal_vote(&vote, v.second.c_str(), v.second.size());

            LOG_DEBUG(
                "Election: Voter \t%s picked candidate: %d", 
                vote.vote_from.c_str(), 
                vote.vote_to.c_str()
            );

            if (vote.vote_to.c_str() == election.candidate_one) 
            {
                c_one_count += 1;
            } else if (vote.vote_to.c_str() == election.candidate_two) 
            {
                c_two_count += 1;
            } else {
                c_three_count += 1;
            }
        }

        candidate_t winner;
        winner.name = "";
        winner.num_votes = -1;
        int draw = 0;

        if (c_one_count > winner.num_votes) 
        {
            draw = 0;
            winner.name = election.candidate_one;
            winner.num_votes = c_one_count;
        }

        if (c_two_count > winner.num_votes) 
        {
            draw = 0;
            winner.name = election.candidate_two;
            winner.num_votes = c_two_count;
        } else if (c_two_count == winner.num_votes) 
        {
            draw = 1;
        }

        if (c_three_count > winner.num_votes) 
        {
            draw = 0;
            winner.name = election.candidate_three;
            winner.num_votes = c_three_count;
        } else if (c_three_count == winner.num_votes) 
        {
            draw = 1;
        }

        if (draw != 1)
        {
            LOG_DEBUG("Winner is: %s with %d votes", winner.name.c_str(), winner.num_votes);
            election.winner = winner.name.c_str();
            election_result = marshal_candidate(&winner);
        }
        else
        {
            LOG_DEBUG("DRAW");
            election_result = ELECTION_DRAW;
        }
    }

    // We can publicly store the result of the election
    std::string election_result_key(election_name + SEP + "outcome" + SEP);

    put_public_state(
        election_result_key.c_str(), 
        (uint8_t*)election_result.c_str(), 
        election_result.size(), 
        ctx
    );

    return OK;
}


// Invoke function
int invoke(
    uint8_t* response,
    uint32_t message_length,
    uint32_t* actual_length,
    shim_ctx_ptr_t ctx
) {
    bool _initialized_;
    const char* _election_;
    char _election_buf[128];

    uint32_t init_len = -1;
    get_state(
        INITIALIZED_KEY, 
        (uint8_t*)&_initialized_, 
        sizeof(_initialized_), 
        &init_len, 
        ctx
    );

    if ((init_len == 0) || !_initialized_)
    {
        _initialized_ = false;
        _election_ = "(not_started)";
    }
    else
    {
        uint32_t x = -1;
        get_state(
            ELECTION_NAME_KEY, 
            (uint8_t*)_election_buf,
            sizeof(_election_buf) - 1, 
            &x, 
            ctx
        );

        if (x == 0)
        {
            _election_ = "(not_started)";
        }
        else
        {
            _election_buf[x + 1] = '\0';
            _election_ = _election_buf;
        }
    }

    LOG_DEBUG(
        "Executing '%s' e-voting chaincode", _election_
    );

    std::string function_name;
    std::vector<std::string> params;
    get_func_and_params(function_name, params, ctx);

    LOG_DEBUG(
        "Function: %s, Params: %s", 
        function_name.c_str(),
        (params.size() < 1
                ? "(none)"
                : std::accumulate(
                      std::next(params.begin()), 
                      params.end(), params[0],
                      [](std::string a, std::string b) 
                      { 
                        return (a + std::string(", ") + b); 
                      }
                  ).c_str()
        )
    );

    std::string election_name = params[0];
    std::string chaincode_result;

    if (!_initialized_ && function_name != "init")
    {
        LOG_ERROR("Election is not yet initialized / No re-initialized allowed");
        *actual_length = 0;
        return -1;
    }

    if (function_name == "init") 
    {
        result = initElection(params[0], ctx);
    }
    else if (function_name == "CreateElection") 
    {
        std::string candidate_one = params[1];
        std::string candidate_two = params[2];
        std::string candidate_three = params[3];

        char voter_name_msp_id[1024];
        char voter_name_dn[1024];
        get_creator_name(
            voter_name_msp_id, 
            sizeof(voter_name_msp_id),
            voter_name_dn, 
            sizeof(voter_name_dn), 
            ctx
        );

        LOG_INFO(
            "The client '(msp_id: %s, dn: %s)' is creating a new election", 
            voter_name_msp_id, 
            voter_name_dn
        );

        result = createElection(election_name, candidate_one, candidate_two, candidate_three, ctx);
    }
    else if (function_name == "QueryElection") 
    {
        result = queryElection(election_name, ctx);
    }
    else if (function_name == "SubmitVote") 
    {
        std::string voter_name = params[1];
        std::string vote_to = params[2];
        
        char voter_name_msp_id[1024];
        char voter_name_dn[1024];
        get_creator_name(
            voter_name_msp_id, 
            sizeof(voter_name_msp_id),
            voter_name_dn, 
            sizeof(voter_name_dn), 
            ctx
        );

        LOG_INFO(
            "The client '(msp_id: %s, dn: %s)' submitting as '%s'",
            voter_name_msp_id, 
            voter_name_dn, 
            voter_name.c_str()
        );

        result = submitVote(election_name, voter_name, vote_to, ctx);
    }
    else if (function_name == "QueryVote") 
    {
        std::string voter_name = params[1];
        result = queryVote(election_name, voter_name, ctx);
    }
    else if (function_name == "CloseElection") 
    {
        result = closeElection(election_name, ctx);
    }
    else if (function_name == "EvaluateElection") 
    {
        result = evaluateElection(election_name, ctx);
    }
    else
    {
        // unknown function
        LOG_ERROR("RECEIVED UNKNOWN transaction");
        *actual_length = 0;
        return -1;
    }

    int size = result.size();
    if (message_length < size)
    {
        // error:  buffer too small for the response to be sent
        LOG_ERROR("Larger buffer required to send message");
        *actual_length = 0;
        return -1;
    }

    // copy result to response
    memcpy(response, result.c_str(), size);
    *actual_length = size;
    LOG_DEBUG("Response: %s", result.c_str());

    LOG_DEBUG("+++ Executing done +++");
    return 0;
}
