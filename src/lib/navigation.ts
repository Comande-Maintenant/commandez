import type {NavigateFunction} from 'react-router-dom';

/** Browser length can include an external page; only the router index identifies an app return. */
export function navigateBack(navigate:NavigateFunction,fallback='/') {
 const index=window.history.state?.idx;
 if(Number.isSafeInteger(index)&&index>0)navigate(-1);
 else navigate(fallback,{replace:true});
}
